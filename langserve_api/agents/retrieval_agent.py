from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langsmith import traceable
from services.vector_store import VectorStore

class SimilarTicket(BaseModel):
    """Model representing a similar ticket found in the vector store."""
    ticket_id: str
    content: str = Field(description="The content of the ticket (title + description)")
    similarity_score: float = Field(description="How similar this ticket is to the query (0-1)")
    solution: str = Field(description="The solution that worked for this ticket")
    resolution: Optional[str] = Field(None, description="Steps taken to resolve the ticket")
    can_auto_resolve: bool = Field(default=False, description="Whether this ticket can be auto-resolved")
    resolution_time: float = Field(description="Time taken to resolve in hours")
    success_rate: float = Field(description="Success rate of the solution (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata about the ticket")

class RetrievalAgent:
    """Agent responsible for finding similar tickets and their solutions."""
    
    def __init__(self, vector_store: VectorStore, resolved_vector_store: Optional[VectorStore] = None):
        """Initialize with vector stores for both new and resolved tickets."""
        self.vector_store = vector_store
        self.resolved_vector_store = resolved_vector_store or VectorStore(collection_name="resolved_tickets")
    
    def _prepare_metadata(
        self,
        content: str,
        solution: Optional[str] = None,
        resolution: Optional[str] = None,
        auto_resolved: bool = False,
        resolution_time: float = 0.0,
        success_rate: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Prepare metadata in a consistent format for both new and resolved tickets."""
        metadata = metadata or {}
        
        # Split metadata into Chroma metadata and document metadata
        chroma_metadata = {
            "creator_id": metadata.get("creator_id"),
            "can_auto_resolve": auto_resolved,
            "category": metadata.get("category", "")[:10],
            "is_resolved": bool(solution)  # Track if ticket has a solution
        }
        
        # Add solution-related fields to document metadata
        doc_metadata = {
            "solution": solution or "",
            "resolution": resolution,
            "resolution_time": resolution_time,
            "success_rate": success_rate,
            **{k: v for k, v in metadata.items() if k not in ["creator_id", "category"]}
        }
        
        return {**chroma_metadata, **doc_metadata}
    
    async def add_ticket(
        self,
        ticket_id: str,
        content: str,
        solution: Optional[str] = None,
        resolution: Optional[str] = None,
        auto_resolved: bool = False,
        resolution_time: float = 0.0,
        success_rate: float = 0.0,
        metadata: Dict[str, Any] = None
    ) -> None:
        """Add a ticket to the appropriate vector store based on resolution status."""
        prepared_metadata = self._prepare_metadata(
            content=content,
            solution=solution,
            resolution=resolution,
            auto_resolved=auto_resolved,
            resolution_time=resolution_time,
            success_rate=success_rate,
            metadata=metadata
        )
        
        # Store in appropriate collection based on resolution status
        store = self.resolved_vector_store if solution else self.vector_store
        await store.store_ticket(
            ticket_id=ticket_id,
            content=content,
            metadata=prepared_metadata
        )
    
    @traceable(name="Find Similar Tickets")
    async def find_similar_tickets(
        self,
        query: str,
        n_results: int = 3,
        similarity_threshold: float = 0.7,
        include_resolved: bool = True
    ) -> List[SimilarTicket]:
        """Find similar tickets based on vector similarity."""
        results = []
        
        # Search new tickets
        new_results = await self.vector_store.find_similar_tickets(
            query_text=query,
            n_results=n_results,
            score_threshold=similarity_threshold
        )
        results.extend(new_results)
        
        # Search resolved tickets if requested
        if include_resolved:
            resolved_results = await self.resolved_vector_store.find_similar_tickets(
                query_text=query,
                n_results=n_results,
                score_threshold=similarity_threshold
            )
            results.extend(resolved_results)
        
        # Sort combined results by similarity score and take top n
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        results = results[:n_results]
        
        similar_tickets = []
        for ticket in results:
            metadata = ticket["metadata"]
            similar_tickets.append(
                SimilarTicket(
                    ticket_id=ticket["ticket_id"],
                    content=ticket["content"],
                    similarity_score=ticket["similarity_score"],
                    solution=metadata.get("solution", ""),
                    resolution=metadata.get("resolution"),
                    can_auto_resolve=metadata.get("can_auto_resolve", False),
                    resolution_time=metadata.get("resolution_time", 0.0),
                    success_rate=metadata.get("success_rate", 0.0),
                    metadata={
                        k: v for k, v in metadata.items()
                        if k not in {
                            "solution", "resolution", "can_auto_resolve",
                            "resolution_time", "success_rate"
                        }
                    }
                )
            )
        
        return similar_tickets
    
    async def update_ticket_solution(
        self,
        ticket_id: str,
        solution: str,
        success_rate: float,
        auto_resolved: bool = False,
        resolution_time: float = 0.0
    ) -> None:
        """Update the solution and success metrics for a ticket and move it to resolved collection."""
        # Get the existing ticket from new tickets collection
        ticket = await self.vector_store.get_ticket(ticket_id)
        if not ticket:
            return
        
        # Prepare updated metadata
        metadata = ticket["metadata"]
        metadata.update({
            "solution": solution,
            "success_rate": success_rate,
            "can_auto_resolve": auto_resolved,
            "resolution_time": resolution_time,
            "is_resolved": True
        })
        
        # Store in resolved collection
        await self.resolved_vector_store.store_ticket(
            ticket_id=ticket_id,
            content=ticket["content"],
            metadata=metadata
        )
        
        # Remove from new tickets collection
        await self.vector_store.delete(ticket_id) 