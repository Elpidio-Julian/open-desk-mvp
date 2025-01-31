from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from services.ticket_agent import TicketAgent

router = APIRouter()
ticket_agent = TicketAgent()

class TicketRequest(BaseModel):
    ticket_id: str

@router.post("/process-ticket")
async def process_ticket(request: TicketRequest):
    """Process a ticket and update its metadata with classification results."""
    try:
        result = await ticket_agent.process_ticket(request.ticket_id)
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=500,
                detail=f"Error processing ticket: {result.get('error', 'Unknown error')}"
            )
            
        return {
            "status": "success",
            "ticket_id": request.ticket_id,
            "processing_result": {
                "can_auto_resolve": result["can_auto_resolve"],
                "confidence": result["confidence"],
                "processing_log": result["processing_log"]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing ticket: {str(e)}"
        ) 