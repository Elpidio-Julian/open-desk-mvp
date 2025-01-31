from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ticket_agent import TicketAgent

router = APIRouter()
ticket_agent = TicketAgent()

class TicketRequest(BaseModel):
    ticket_id: str

@router.post("/process-ticket")
async def process_ticket(request: TicketRequest):
    """Process a ticket and determine if it can be auto-resolved."""
    try:
        result = await ticket_agent.process_ticket(request.ticket_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 