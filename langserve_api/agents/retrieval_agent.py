from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langsmith import traceable

class SimilarTicket(BaseModel):
    """Model representing a similar ticket found in the vector store."""
    ticket_id: str
    content: str = Field(description="The content of the ticket (title + description)")
    similarity_score: float = Field(description="How similar this ticket is to the query (0-1)")
    solution: str = Field(description="The solution that worked for this ticket")
    resolution: Optional[str] = Field(None, description="Steps taken to resolve the ticket")
    auto_resolved: bool = Field(default=False, description="Whether this ticket was auto-resolved")
    resolution_time: float = Field(description="Time taken to resolve in hours")
    success_rate: float = Field(description="Success rate of the solution (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata about the ticket")

class RetrievalAgent:
    """Agent responsible for finding similar tickets and their solutions."""
    
    def __init__(self, vector_store: Chroma):
        self.vector_store = vector_store
        self.embeddings = OpenAIEmbeddings()
    
    async def add_ticket(
        self,
        ticket_id: str,
        content: str,
        solution: str,
        resolution: Optional[str] = None,
        auto_resolved: bool = False,
        resolution_time: float = 0.0,
        success_rate: float = 0.0,
        metadata: Dict[str, Any] = None
    ) -> None:
        """Add a ticket to the vector store."""
        metadata = metadata or {}
        metadata.update({
            "ticket_id": ticket_id,
            "solution": solution,
            "resolution": resolution,
            "auto_resolved": auto_resolved,
            "resolution_time": resolution_time,
            "success_rate": success_rate
        })
        
        await self.vector_store.aadd_texts(
            texts=[content],
            metadatas=[metadata]
        )
    
    @traceable(name="Find Similar Tickets")
    async def find_similar_tickets(
        self,
        query: str,
        n_results: int = 3,
        similarity_threshold: float = 0.7
    ) -> List[SimilarTicket]:
        """Find similar tickets based on vector similarity."""
        # Search the vector store
        results = await self.vector_store.asimilarity_search_with_relevance_scores(
            query,
            k=n_results
        )
        
        similar_tickets = []
        for doc, score in results:
            if score < similarity_threshold:
                continue
                
            metadata = doc.metadata
            similar_tickets.append(
                SimilarTicket(
                    ticket_id=metadata["ticket_id"],
                    content=doc.page_content,
                    similarity_score=score,
                    solution=metadata["solution"],
                    resolution=metadata.get("resolution"),
                    auto_resolved=metadata.get("auto_resolved", False),
                    resolution_time=metadata.get("resolution_time", 0.0),
                    success_rate=metadata.get("success_rate", 0.0),
                    metadata={
                        k: v for k, v in metadata.items()
                        if k not in {
                            "ticket_id", "solution", "resolution",
                            "auto_resolved", "resolution_time", "success_rate"
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
        """Update the solution and success metrics for a ticket."""
        # Find the document by ticket_id
        results = await self.vector_store.asimilarity_search_with_relevance_scores(
            f"ticket_id:{ticket_id}",
            k=1,
            filter={"ticket_id": ticket_id}
        )
        
        if not results:
            return
        
        doc, _ = results[0]
        metadata = doc.metadata
        metadata.update({
            "solution": solution,
            "success_rate": success_rate,
            "auto_resolved": auto_resolved,
            "resolution_time": resolution_time
        })
        
        # Remove old document and add updated one
        await self.vector_store.adelete([doc.metadata["ticket_id"]])
        await self.vector_store.aadd_texts(
            texts=[doc.page_content],
            metadatas=[metadata]
        ) 