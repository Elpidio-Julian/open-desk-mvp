from fastapi import FastAPI
from services.vector_store import VectorStore
from dotenv import load_dotenv
from routers.ticket_router import router as ticket_router
import os

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Ticket Processing API",
    description="API for processing support tickets using a multi-agent system"
)

# Initialize services and agents
vector_store_tickets = VectorStore(collection_name="tickets")

# Include routers
app.include_router(ticket_router, prefix="/tickets", tags=["tickets"])

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 