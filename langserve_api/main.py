from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from agents.ingestion_agent import IngestionAgent, TicketData
from uuid import UUID

class TicketRequest(BaseModel):
    title: str
    description: str
    creator_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None
    additional_context: Optional[Dict[str, Any]] = None

class TicketResponse(BaseModel):
    """Response model including both structured ticket and vector data."""
    ticket: TicketData
    vector_data: Dict[str, Any]

app = FastAPI(
    title="Ticket Processing API",
    description="API for processing support tickets using a multi-agent system"
)

# Initialize the ingestion agent
ingestion_agent = IngestionAgent()

@app.post("/process-ticket", response_model=TicketResponse)
async def process_ticket(ticket: TicketRequest):
    """
    Process a new support ticket.
    
    This endpoint:
    1. Accepts ticket information
    2. Processes it through the ingestion agent
    3. Prepares data for vector storage
    4. Returns both structured ticket and vector data
    
    The agent will:
    - Analyze ticket content
    - Determine priority
    - Add relevant tags and categories
    - Extract technical details
    - Generate embeddings for vector storage
    """
    try:
        # Prepare context dictionary
        context = ticket.additional_context or {}
        if ticket.creator_id:
            context["creator_id"] = str(ticket.creator_id)
            
        # Process the ticket
        processed_ticket = await ingestion_agent.process_ticket(
            title=ticket.title,
            description=ticket.description,
            existing_metadata=ticket.metadata,
            context=context
        )
        
        # Prepare for vector storage
        vector_data = await ingestion_agent.prepare_for_vectordb(processed_ticket)
        
        return TicketResponse(
            ticket=processed_ticket,
            vector_data=vector_data
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing ticket: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"} 