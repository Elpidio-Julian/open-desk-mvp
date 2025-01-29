from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID

class TicketMetadata(BaseModel):
    """Dynamic metadata model that can handle various fields."""
    Issue_Category: Optional[str] = None
    ticket_tags: list[str] = []
    product_area: Optional[str] = None
    browser: Optional[str] = None
    platform: Optional[str] = None
    urgency_indicators: list[str] = []
    key_entities: list[str] = []
    technical_terms: list[str] = []
    
    # Allow additional fields
    model_config = ConfigDict(extra='allow')

class TicketData(BaseModel):
    """Structured ticket data model."""
    title: str
    description: str
    priority: str
    status: str = "new"
    creator_id: Optional[UUID] = None
    metadata: TicketMetadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    def to_chroma_document(self) -> Dict[str, Any]:
        """Convert ticket to document format for ChromaDB."""
        return {
            "id": str(hash(f"{self.title}{self.description}{self.created_at}")),
            "text": self.get_text_for_embedding(),
            "metadata": self.metadata.model_dump()
        }
    
    def get_text_for_embedding(self) -> str:
        """Get text representation for embedding."""
        category = f"category: {self.metadata.Issue_Category}" if self.metadata.Issue_Category else "category: unspecified"
        tags = f"tags: {', '.join(self.metadata.ticket_tags)}" if self.metadata.ticket_tags else "tags: none"
        technical = f"technical terms: {', '.join(self.metadata.technical_terms)}" if self.metadata.technical_terms else ""
        
        parts = [
            f"title: {self.title}",
            f"description: {self.description}",
            f"priority: {self.priority}",
            category,
            tags
        ]
        if technical:
            parts.append(technical)
        
        return "\n".join(parts) 