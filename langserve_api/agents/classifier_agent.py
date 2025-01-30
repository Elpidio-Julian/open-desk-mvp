from typing import List, Optional, Dict, Any, Tuple
from typing_extensions import NotRequired
from pydantic import BaseModel, Field
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langsmith import traceable
from .ingestion_agent import TicketData
from .retrieval_agent import SimilarTicket, RetrievalAgent
import os
from datetime import datetime
import logging
import httpx
from postgrest import AsyncPostgrestClient

logger = logging.getLogger(__name__)

class SupabaseConnectionError(Exception):
    """Raised when there are issues connecting to Supabase."""
    pass

class NoTeamsFoundError(Exception):
    """Raised when no teams are found in the database."""
    pass

class TeamData(BaseModel):
    """Team data from Supabase."""
    id: str
    name: str
    description: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def get_default_team(cls) -> 'TeamData':
        """Return a default general support team when no teams are available."""
        return cls(
            id="default",
            name="General Support",
            description="Default team for handling tickets when no other teams are available",
            metadata={
                "focus_area": {"value": "general", "label": "General Support"},
                "Skills": ["general support"],
                "technical_level": "junior"
            },
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

class RequiredSkills(BaseModel):
    """Skills required to handle the ticket."""
    technical_level: str = Field(description="Required technical expertise level: junior, mid, senior")
    domain_knowledge: List[str] = Field(description="Required domain knowledge areas")
    tools_expertise: List[str] = Field(description="Required tools or technologies expertise")

class ClassificationDecision(BaseModel):
    """Complete classification of a ticket."""
    can_auto_resolve: bool = Field(description="Whether the ticket can be automatically resolved")
    routing_team: TeamData = Field(description="Team that should handle this ticket")
    confidence_score: float = Field(description="Confidence in the classification decision (0-1)")
    auto_resolution_steps: Optional[List[str]] = Field(description="Steps for auto-resolution if applicable", default=None)

@traceable(name="Ticket Classifier Agent")
class ClassifierAgent:
    """Agent responsible for determining ticket routing and resolution approach."""
    
    def __init__(self, retrieval_agent: RetrievalAgent):
        self.retrieval_agent = retrieval_agent
        self.llm = ChatOpenAI(temperature=0)
        
        # Initialize PostgREST client
        try:
            supabase_url = os.getenv("VITE_PROD_SUPABASE_URL")
            supabase_key = os.getenv("VITE_PROD_SUPABASE_ANON_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("Supabase credentials not found in environment variables")
            
            # Extract PostgREST URL from Supabase URL
            rest_url = f"{supabase_url}/rest/v1"
            self.postgrest = AsyncPostgrestClient(
                rest_url,
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}"
                }
            )
        except Exception as e:
            logger.error(f"Failed to initialize PostgREST client: {str(e)}")
            raise SupabaseConnectionError(f"Failed to initialize PostgREST client: {str(e)}")
        
        # Cache for team data
        self._teams_cache: Optional[List[TeamData]] = None
        self._teams_cache_timestamp: Optional[float] = None
        self._cache_ttl = 300  # 5 minutes cache TTL
        
        # Classification prompt
        self.classify_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert ticket classifier for a support system. Analyze the ticket and similar historical tickets to determine:
            1. If the ticket can be automatically resolved
            2. What team should handle it
            3. Required skills and expertise
            4. Whether more information is needed
            
            Consider:
            - Ticket content and metadata
            - Similar historical tickets and their resolutions
            - Technical complexity and domain knowledge required
            - Available automation capabilities
            
            Be thorough in your analysis but decisive in your recommendations."""),
            ("human", """Please analyze this ticket:
            Title: {title}
            Description: {description}
            Priority: {priority}
            Category: {category}
            Tags: {tags}
            
            Similar tickets and their resolutions:
            {similar_tickets}
            
            Determine the best handling approach and provide your classification decision.""")
        ])
    
    async def _get_teams(self, force_refresh: bool = False) -> List[TeamData]:
        """Get all teams from the database."""
        print("\n=== _get_teams method started ===")
        
        if not force_refresh and self._teams_cache:
            print("Using cached teams data")
            return self._teams_cache

        print("Fetching fresh teams data from PostgREST...")
        try:
            print("Created PostgREST query")
            response = await self.postgrest.from_("teams").select("*").execute()
            print("Executed select query")
            print(f"Got response with data: {response.data}")

            # Convert response data to TeamData objects
            teams = []
            for team_data in response.data:
                if isinstance(team_data, TeamData):
                    teams.append(team_data)
                else:
                    teams.append(TeamData(**team_data))
            
            if teams:
                self._teams_cache = teams
                return teams
            
            # Return default team if no teams found
            default_team = TeamData(
                id="default",
                name="General Support",
                description="Default team for handling tickets when no other teams are available",
                metadata={
                    "focus_area": {"value": "general", "label": "General Support"},
                    "Skills": ["general support"],
                    "technical_level": "junior"
                },
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            return [default_team]

        except Exception as e:
            print(f"Unexpected error fetching teams: {str(e)}")
            # Return default team on error
            default_team = TeamData(
                id="default",
                name="General Support",
                description="Default team for handling tickets when no other teams are available",
                metadata={
                    "focus_area": {"value": "general", "label": "General Support"},
                    "Skills": ["general support"],
                    "technical_level": "junior"
                },
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            return [default_team]

    def _calculate_team_match_score(
        self,
        team: TeamData,
        category: str,
        ticket_tags: List[str]
    ) -> float:
        """Calculate how well a team matches the ticket requirements."""
        score = 0.0
        
        # Check focus area match
        team_focus = team.metadata.get("focus_area", {}).get("value", "").lower()
        category = category.lower()
        
        # Check if this is an unclear ticket
        is_unclear = len(ticket_tags) <= 1 and category in ["technical", "general", "unknown", ""]
        
        if is_unclear and team_focus == "general":
            # Unclear tickets should go to general support
            score += 0.8
        elif team_focus == category:
            score += 0.7  # High score for exact category match
        elif team_focus == "general":
            score += 0.2  # Fallback option for other categories
        
        # Bonus for tag matches
        team_tags = set(team.metadata.get("tags", []))
        ticket_tags_set = set(ticket_tags)
        if ticket_tags_set and team_tags:
            tag_match_ratio = len(team_tags & ticket_tags_set) / len(ticket_tags_set)
            score += 0.3 * tag_match_ratio  # Tag matches are important but secondary
        
        return min(score, 1.0)

    async def _determine_routing_team(
        self,
        category: str,
        ticket_tags: List[str],
        can_auto_resolve: bool
    ) -> Tuple[TeamData, float]:
        """Determine the appropriate team for routing."""
        try:
            teams = await self._get_teams()
            
            if can_auto_resolve:
                # Find auto-resolution team
                auto_teams = [
                    t for t in teams 
                    if t.metadata.get("focus_area", {}).get("value") == "auto_resolution" or
                    t.name == "Auto Resolution"
                ]
                if auto_teams:
                    return auto_teams[0], 1.0
            
            # Calculate match scores for each team
            team_scores = [
                (team, self._calculate_team_match_score(team, category, ticket_tags))
                for team in teams
            ]
            
            # Sort by score and get best match
            best_team, score = max(team_scores, key=lambda x: x[1])
            
            # If score is too low, fallback to default team
            if score < 0.3:
                return TeamData.get_default_team(), 0.5
                
            return best_team, score
            
        except Exception as e:
            logger.error(f"Error determining routing team: {str(e)}")
            return TeamData.get_default_team(), 0.5

    def _format_similar_tickets(self, similar_tickets: List[SimilarTicket]) -> str:
        """Format similar tickets for prompt input."""
        if not similar_tickets:
            return "No similar tickets found."
        
        formatted = []
        for i, ticket in enumerate(similar_tickets, 1):
            formatted.append(f"""
            Ticket {i}:
            - Content: {ticket.content}
            - Resolution: {ticket.resolution if ticket.resolution else 'Not resolved'}
            - Auto-resolved: {ticket.auto_resolved}
            - Resolution time: {ticket.resolution_time} hours
            """)
        return "\n".join(formatted)
    
    def _analyze_auto_resolution_potential(
        self,
        ticket: TicketData,
        similar_tickets: List[SimilarTicket]
    ) -> Tuple[bool, List[str]]:
        """Analyze if a ticket can be automatically resolved based on similar tickets."""
        # Check if there are similar tickets that were auto-resolved
        auto_resolved_tickets = [t for t in similar_tickets if t.auto_resolved]
        if not auto_resolved_tickets:
            return False, []
        
        # Calculate the average success rate of auto-resolved tickets
        avg_success_rate = sum(t.success_rate for t in auto_resolved_tickets) / len(auto_resolved_tickets)
        
        # Check if the category is typically auto-resolvable
        auto_resolvable_categories = {"password_reset", "account_unlock", "mfa_reset"}
        is_auto_resolvable_category = ticket.metadata.Issue_Category.lower() in auto_resolvable_categories
        
        # If success rate is high and category is auto-resolvable, extract steps
        if avg_success_rate > 0.8 and is_auto_resolvable_category:
            # Get the most successful auto-resolution steps
            best_ticket = max(auto_resolved_tickets, key=lambda t: t.success_rate)
            if best_ticket.resolution:
                steps = [step.strip() for step in best_ticket.resolution.split('\n') if step.strip()]
                return True, steps
        
        return False, []

    @traceable(name="Classify Ticket")
    async def classify_ticket(
        self,
        ticket: TicketData,
        similar_tickets: List[SimilarTicket]
    ) -> ClassificationDecision:
        """Classify a ticket and determine routing and resolution approach."""
        
        # First, check if the ticket can be auto-resolved
        can_auto_resolve, auto_steps = self._analyze_auto_resolution_potential(ticket, similar_tickets)
        
        # Determine routing team
        team, confidence = await self._determine_routing_team(
            ticket.metadata.Issue_Category,
            ticket.metadata.ticket_tags,
            can_auto_resolve
        )
        
        return ClassificationDecision(
            can_auto_resolve=can_auto_resolve,
            routing_team=team,
            confidence_score=confidence,
            auto_resolution_steps=auto_steps if can_auto_resolve else None
        ) 