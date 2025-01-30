from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import UUID
import logging
from agents.ingestion_agent import IngestionAgent
from agents.classifier_agent import ClassifierAgent
from agents.retrieval_agent import RetrievalAgent
from agents.auto_resolution_agent import AutoResolutionAgent
from flows.auto_resolution_flow import create_auto_resolution_flow, initialize_state
from services.vector_store import VectorStore
from langserve import add_routes
from langchain.chains import TransformChain
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class TicketMetadata(BaseModel):
    """Model for ticket metadata."""
    Issue_Category: str

class Ticket(BaseModel):
    """Model for incoming ticket data."""
    id: UUID
    title: str
    description: str
    status: str
    priority: str
    creator_id: UUID
    assigned_agent_id: Optional[UUID] = None
    metadata: TicketMetadata
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

class TicketResponse(BaseModel):
    """Response model for processed ticket."""
    ticket_id: str
    can_auto_resolve: bool
    auto_resolution_steps: Optional[List[str]] = None
    routing_team: Optional[Dict[str, Any]] = None
    confidence_score: float
    status: str  # Track ticket status after processing
    priority: str  # Maintain original priority
    assigned_agent_id: Optional[UUID] = None  # Track assignment if routed

app = FastAPI(
    title="Ticket Processing API",
    description="API for processing support tickets using a multi-agent system"
)

# Initialize services and agents
vector_store = VectorStore(collection_name="tickets")
ingestion_agent = IngestionAgent()
retrieval_agent = RetrievalAgent(vector_store=vector_store)
classifier_agent = ClassifierAgent(retrieval_agent)
auto_resolution_agent = AutoResolutionAgent(vector_store=vector_store)

# Create resolution flow
resolution_flow = create_auto_resolution_flow(
    auto_resolution_agent=auto_resolution_agent,
    classifier_agent=classifier_agent,
    retrieval_agent=retrieval_agent
)

# Create a chain for the ticket processing endpoint
ticket_chain = TransformChain(
    input_variables=["ticket"],
    output_variables=["processed_result"],
    transform=lambda inputs: {
        "processed_result": process_ticket(Ticket(**inputs["ticket"]))
    }
)

# Add LangServe route for ticket processing
add_routes(
    app,
    ticket_chain,
    path="/langserve/process-ticket",
    enabled_endpoints=["invoke", "batch"]
)

@app.post("/process-ticket", response_model=TicketResponse)
async def process_ticket(ticket: Ticket):
    """
    Process a support ticket through the auto-resolution pipeline.
    
    This endpoint:
    1. Processes the ticket through ingestion agent
    2. Stores in vector database
    3. Runs through auto-resolution flow if possible
    4. Routes to appropriate team if needed
    """
    try:
        # Process through ingestion agent
        processed_ticket = await ingestion_agent.process_ticket(
            title=ticket.title,
            description=ticket.description,
            existing_metadata=ticket.metadata.dict(),
            context={
                "creator_id": str(ticket.creator_id),
                "priority": ticket.priority,
                "created_at": ticket.created_at.isoformat(),
                "ticket_id": str(ticket.id)
            }
        )
        
        # Store in vector database
        combined_content = f"{ticket.title}\n{ticket.description}"
        await vector_store.store_ticket(
            ticket_id=str(ticket.id),
            content=combined_content,
            metadata={
                "title": ticket.title,
                "category": ticket.metadata.Issue_Category,
                "priority": ticket.priority,
                "status": ticket.status,
                "creator_id": str(ticket.creator_id),
                "created_at": ticket.created_at.isoformat()
            }
        )
        
        # Initialize and run auto-resolution flow
        flow_state = initialize_state({
            "id": str(ticket.id),
            "title": ticket.title,
            "description": ticket.description,
            "category": ticket.metadata.Issue_Category,
            "priority": ticket.priority,
            "creator_id": str(ticket.creator_id),
            "status": ticket.status,
            "created_at": ticket.created_at.isoformat()
        })
        
        final_state = await resolution_flow.ainvoke(flow_state)
        resolution = final_state["final_resolution"]
        classification = final_state["classification"]
        
        # Determine final status and assignment
        new_status = "auto_resolving" if resolution.success else "pending"
        assigned_agent_id = None
        if not resolution.success and classification.get("routing_team"):
            new_status = "assigned"
            # In a real system, we would assign to a specific agent in the routing team
            # For now, we'll just indicate it needs assignment
            assigned_agent_id = None
        
        return TicketResponse(
            ticket_id=str(ticket.id),
            can_auto_resolve=classification.get("can_auto_resolve", False),
            auto_resolution_steps=resolution.solution if resolution.success else None,
            routing_team=classification.get("routing_team") if not resolution.success else None,
            confidence_score=classification.get("confidence_score", 0.0),
            status=new_status,
            priority=ticket.priority,
            assigned_agent_id=assigned_agent_id
        )
        
    except Exception as e:
        logger.error(f"Error processing ticket: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing ticket: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 