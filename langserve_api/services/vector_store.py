from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import chromadb
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
import json
import os

logger = logging.getLogger(__name__)

class VectorStore:
    """Service class for managing ticket embeddings and similarity search using Chroma."""
    
    def __init__(self, collection_name: str = "tickets"):
        """Initialize with a collection name."""
        # Initialize the Chroma client with cloud configuration
        self.client = chromadb.HttpClient(
            ssl=True,
            host=os.getenv('CHROMA_HOST'),
            tenant=os.getenv('CHROMA_TENANT'),
            database=os.getenv('CHROMA_DATABASE'),
            headers={
                'x-chroma-token': os.getenv('CHROMA_API_KEY')
            }
        )
        
        # First create the collection
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings()
        
        # Initialize LangChain's Chroma wrapper with our client and existing collection
        self.vectorstore = Chroma(
            client=self.client,
            collection_name=collection_name,
            embedding_function=self.embeddings
        )
    
    def _check_metadata_size(self, metadata: Dict[str, Any]) -> None:
        """Validate metadata size before storage."""
        metadata_str = json.dumps(metadata)
        size_bytes = len(metadata_str.encode('utf-8'))
        if size_bytes > 30:
            logger.warning(f"Metadata size ({size_bytes} bytes) exceeds limit of 30 bytes")
            # Truncate category if needed
            if "category" in metadata:
                metadata["category"] = metadata["category"][:10]

    def _format_document_content(self, content: str, metadata: Dict[str, Any]) -> str:
        """Format ticket content and non-metadata fields into a structured document."""
        # Extract fields that should go into document content
        doc_metadata = {
            "status": metadata.pop("status", None),
            "priority": metadata.pop("priority", None),
            "stored_at": metadata.pop("stored_at", datetime.utcnow().isoformat()[:19]),
            # Add any other fields that should be in document but not metadata
        }
        
        # Remove None values
        doc_metadata = {k: v for k, v in doc_metadata.items() if v is not None}
        
        # Format the document content with metadata as JSON header
        return f"{json.dumps(doc_metadata)}\n\n{content}"

    async def store_ticket(
        self,
        ticket_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Store a ticket in the vector store."""
        try:
            metadata = metadata or {}
            
            # Keep only essential fields in metadata
            filtered_metadata = {
                "creator_id": metadata.get("creator_id"),
                "can_auto_resolve": metadata.get("can_auto_resolve", False),
                "category": metadata.get("category", "")[:10]
            }
            
            # Format document content with remaining metadata
            formatted_content = self._format_document_content(content, metadata)
            
            # Create document
            document = Document(
                page_content=formatted_content,
                metadata=filtered_metadata
            )
            
            # Add document using LangChain's wrapper
            await self.vectorstore.aadd_documents(
                documents=[document],
                ids=[ticket_id]
            )
            
            logger.info(f"Successfully stored ticket {ticket_id}")
            
        except Exception as e:
            logger.error(f"Error storing ticket {ticket_id}: {str(e)}")
            raise
    
    async def find_similar_tickets(
        self,
        query_text: str,
        n_results: int = 5,
        score_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Find similar tickets using semantic search."""
        try:
            if isinstance(query_text, dict):
                query_text = f"{query_text.get('title', '')} {query_text.get('description', '')}"
            elif not isinstance(query_text, str):
                query_text = str(query_text)
            
            docs_and_scores = await self.vectorstore.asimilarity_search_with_relevance_scores(
                query=query_text,
                k=n_results
            )
            
            similar_tickets = []
            for doc, score in docs_and_scores:
                similarity_score = (score + 1) / 2
                
                if similarity_score >= score_threshold:
                    # Parse the document content to separate metadata and content
                    content_parts = doc.page_content.split("\n\n", 1)
                    doc_metadata = json.loads(content_parts[0]) if len(content_parts) > 1 else {}
                    actual_content = content_parts[1] if len(content_parts) > 1 else doc.page_content
                    
                    # Combine metadata from both sources
                    combined_metadata = {**doc.metadata, **doc_metadata}
                    
                    similar_tickets.append({
                        "ticket_id": doc.id,
                        "content": actual_content,
                        "metadata": combined_metadata,
                        "similarity_score": similarity_score
                    })
            
            return similar_tickets
            
        except Exception as e:
            logger.error(f"Error searching similar tickets: {str(e)}")
            raise
    
    async def get_ticket(self, ticket_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific ticket by ID."""
        try:
            result = self.collection.get(
                ids=[ticket_id],
                include=["documents", "metadatas"]
            )
            
            if not result or not result['ids']:
                return None
            
            # Parse the document content to separate metadata and content
            content_parts = result['documents'][0].split("\n\n", 1)
            doc_metadata = json.loads(content_parts[0]) if len(content_parts) > 1 else {}
            actual_content = content_parts[1] if len(content_parts) > 1 else result['documents'][0]
            
            # Combine metadata from both sources
            combined_metadata = {**result['metadatas'][0], **doc_metadata}
            
            return {
                "ticket_id": ticket_id,
                "content": actual_content,
                "metadata": combined_metadata
            }
            
        except Exception as e:
            logger.error(f"Error retrieving ticket {ticket_id}: {str(e)}")
            raise
    
    async def update_ticket_metadata(
        self,
        ticket_id: str,
        metadata_updates: Dict[str, Any]
    ) -> None:
        """Update metadata for a specific ticket."""
        try:
            ticket = await self.get_ticket(ticket_id)
            if not ticket:
                raise ValueError(f"Ticket {ticket_id} not found")
            
            # Split updates between Chroma metadata and document content
            chroma_metadata_updates = {
                k: v for k, v in metadata_updates.items() 
                if k in ["creator_id", "can_auto_resolve", "category"]
            }
            
            doc_metadata_updates = {
                k: v for k, v in metadata_updates.items()
                if k not in ["creator_id", "can_auto_resolve", "category"]
            }
            
            if chroma_metadata_updates:
                # Update Chroma metadata
                new_metadata = {**ticket["metadata"], **chroma_metadata_updates}
                if "category" in new_metadata:
                    new_metadata["category"] = new_metadata["category"][:10]
                self.collection.update(
                    ids=[ticket_id],
                    metadatas=[new_metadata]
                )
            
            if doc_metadata_updates:
                # Update document content metadata
                content_parts = ticket["content"].split("\n\n", 1)
                doc_metadata = json.loads(content_parts[0]) if len(content_parts) > 1 else {}
                actual_content = content_parts[1] if len(content_parts) > 1 else ticket["content"]
                
                new_doc_metadata = {**doc_metadata, **doc_metadata_updates}
                new_content = f"{json.dumps(new_doc_metadata)}\n\n{actual_content}"
                
                self.collection.update(
                    ids=[ticket_id],
                    documents=[new_content]
                )
            
            logger.info(f"Successfully updated metadata for ticket {ticket_id}")
            
        except Exception as e:
            logger.error(f"Error updating ticket {ticket_id} metadata: {str(e)}")
            raise 