from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain.output_parsers import PydanticOutputParser
from langchain_openai import OpenAIEmbeddings
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
    """Ticket model matching Supabase structure with additional processing fields."""
    id: Optional[UUID] = None
    title: str
    description: str
    status: str = "new"
    priority: str
    creator_id: Optional[UUID] = None
    assigned_agent_id: Optional[UUID] = None
    metadata: TicketMetadata = Field(default_factory=TicketMetadata)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    def get_text_for_embedding(self) -> str:
        """Get formatted text for generating embeddings."""
        metadata = self.metadata
        tags = " ".join(metadata.ticket_tags) if metadata.ticket_tags else ""
        technical = " ".join(metadata.technical_terms) if metadata.technical_terms else ""
        
        # Combine relevant fields for embedding
        text_parts = [
            self.title,
            self.description,
            f"priority: {self.priority}",
            f"category: {metadata.Issue_Category}" if metadata.Issue_Category else "",
            f"product: {metadata.product_area}" if metadata.product_area else "",
            f"tags: {tags}" if tags else "",
            f"technical details: {technical}" if technical else ""
        ]
        
        return " ".join([part for part in text_parts if part])

    def to_chroma_document(self) -> Dict[str, Any]:
        """Convert ticket to ChromaDB document format."""
        return {
            "id": str(self.id) if self.id else None,
            "text": self.get_text_for_embedding(),
            "metadata": {
                "title": self.title,
                "priority": self.priority,
                "status": self.status,
                "creator_id": str(self.creator_id) if self.creator_id else None,
                "category": self.metadata.Issue_Category,
                "product_area": self.metadata.product_area,
                "tags": self.metadata.ticket_tags,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
            }
        }

class IngestionAgent:
    """Agent responsible for structuring incoming ticket data and preparing for vector storage."""
    
    def __init__(self):
        self.llm = ChatOpenAI(temperature=0)
        self.output_parser = PydanticOutputParser(pydantic_object=TicketData)
        self.embeddings = OpenAIEmbeddings()
        
        # Create the chat prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template("""You are an expert ticket processing agent. 
            Analyze the ticket information and structure it according to these rules:

            1. Priority Assessment:
               - HIGH: Security issues, system-wide errors, login problems, data loss
               - MEDIUM: Feature malfunctions, performance issues, UI problems
               - LOW: Feature requests, documentation, cosmetic issues

            2. Issue Category Assignment:
               - Authentication: Login, access, permissions
               - Technical: Errors, system issues, integrations
               - Billing: Payment, subscription, pricing
               - Account Management: Profile, settings, preferences
               - Feature Request: New features, improvements
               - Bug: Software defects, unexpected behavior
               - Performance: Speed, resource usage
               - Documentation: Help, guides, explanations

            3. Metadata Enhancement:
               - Add relevant ticket_tags based on content
               - Identify product areas mentioned
               - Extract browser/platform information
               - List technical terms and error codes
               - Note urgency indicators
               - Identify key entities (features, components)

            Format the output exactly according to the specified schema.
            Ensure all metadata fields are properly categorized and tagged.
            Keep the original metadata fields if provided, but enhance them with additional information."""),
            HumanMessagePromptTemplate.from_template("""Analyze this ticket:
            Title: {title}
            Description: {description}
            Current Metadata: {metadata}
            Additional Context: {context}
            
            Structure this information according to the specified format, preserving any existing metadata fields.""")
        ])
        
    async def process_ticket(
        self,
        title: str,
        description: str,
        existing_metadata: Dict[str, Any] = None,
        context: Dict[str, Any] = None
    ) -> TicketData:
        """Process incoming ticket and return structured data."""
        if context is None:
            context = {}
        if existing_metadata is None:
            existing_metadata = {}
            
        # Format the conversation with the ticket details
        messages = self.prompt.format_messages(
            title=title,
            description=description,
            metadata=str(existing_metadata),
            context=str(context)
        )
        
        # Get structured response from LLM
        response = await self.llm.agenerate([messages])
        result = response.generations[0][0].text
        
        try:
            # Parse the response into our TicketData structure
            ticket_data = self.output_parser.parse(result)
            
            # Preserve existing metadata fields and merge with new ones
            if existing_metadata:
                # Create a new metadata instance with existing data
                merged_metadata = {**existing_metadata}
                # Update with new fields from LLM processing
                merged_metadata.update(ticket_data.metadata.dict(exclude_unset=True))
                # Update ticket metadata
                ticket_data.metadata = TicketMetadata(**merged_metadata)
            
            # Add context information if available
            if context.get("creator_id"):
                ticket_data.creator_id = UUID(context["creator_id"])
                
            return ticket_data
            
        except Exception as e:
            # Fallback to basic structure if parsing fails
            return TicketData(
                title=title,
                description=description,
                status="new",
                priority="medium",
                metadata=TicketMetadata(**existing_metadata) if existing_metadata else TicketMetadata()
            )
            
    async def get_embeddings(self, text: str) -> List[float]:
        """Generate embeddings for text using OpenAI."""
        return await self.embeddings.aembed_query(text)
        
    async def prepare_for_vectordb(self, ticket: TicketData) -> Dict[str, Any]:
        """Prepare ticket for storage in ChromaDB."""
        # Convert ticket to document format
        document = ticket.to_chroma_document()
        
        # Generate embeddings for the document text
        if document["text"]:
            embeddings = await self.get_embeddings(document["text"])
            document["embeddings"] = embeddings
            
        return document 