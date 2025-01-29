from typing import Dict, Any
from langchain.vectorstores import Chroma
from agents.ingestion_agent import IngestionAgent, TicketData
from agents.retrieval_agent import RetrievalAgent
from agents.classifier_agent import ClassifierAgent
from agents.resolution_agent import ResolutionAgent, Resolution

class TicketOrchestrator:
    """Coordinates the multi-agent workflow for ticket processing."""
    
    def __init__(self, vector_store: Chroma):
        self.ingestion_agent = IngestionAgent()
        self.retrieval_agent = RetrievalAgent(vector_store)
        self.classifier_agent = ClassifierAgent(self.retrieval_agent)
        self.resolution_agent = ResolutionAgent()
        
    async def process_ticket(self, title: str, description: str) -> Dict[str, Any]:
        """Process a ticket through the entire multi-agent workflow."""
        
        # Step 1: Ingest and structure the ticket
        structured_ticket = await self.ingestion_agent.process_ticket(title, description)
        
        # Step 2: Find similar tickets
        similar_tickets = await self.retrieval_agent.find_similar_tickets(
            f"{structured_ticket.title}\n{structured_ticket.description}"
        )
        
        # Step 3: Classify the ticket
        classification = await self.classifier_agent.classify_ticket(
            structured_ticket,
            similar_tickets
        )
        
        # Step 4: Generate resolution if auto-resolvable
        resolution = None
        if classification.can_auto_resolve:
            resolution = await self.resolution_agent.generate_resolution(
                structured_ticket,
                classification,
                similar_tickets
            )
            
        # Return complete workflow results
        return {
            "structured_ticket": structured_ticket.dict(),
            "similar_tickets": [t.dict() for t in similar_tickets],
            "classification": classification.dict(),
            "resolution": resolution.dict() if resolution else None
        } 