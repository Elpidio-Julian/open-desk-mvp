from typing import List, Optional
from pydantic import BaseModel
from langchain.prompts import ChatPromptTemplate
from .ingestion_agent import TicketData
from .retrieval_agent import SimilarTicket, RetrievalAgent

class ClassificationDecision(BaseModel):
    can_auto_resolve: bool
    confidence_score: float
    routing_team: Optional[str] = None
    reasoning: str
    needs_more_info: bool = False

class ClassifierAgent:
    """Agent responsible for determining if a ticket can be auto-resolved."""
    
    def __init__(self, retrieval_agent: RetrievalAgent, max_iterations: int = 3):
        self.retrieval_agent = retrieval_agent
        self.max_iterations = max_iterations
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert ticket classifier. Your role is to:
            1. Analyze structured ticket data
            2. Review similar historical tickets
            3. Determine if auto-resolution is possible
            4. Request more information if needed
            
            Make decisions with clear reasoning."""),
            ("human", "{input}")
        ])
        
    async def classify_ticket(
        self,
        ticket: TicketData,
        similar_tickets: List[SimilarTicket]
    ) -> ClassificationDecision:
        """Classify ticket and determine routing."""
        # TODO: Implement actual classification logic
        return ClassificationDecision(
            can_auto_resolve=True,
            confidence_score=0.85,
            routing_team=None,
            reasoning="Placeholder reasoning",
            needs_more_info=False
        ) 