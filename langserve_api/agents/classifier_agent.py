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
    confidence_score: float = Field(description="Confidence in the classification decision (0-1)")
    routing_team: TeamData = Field(description="Team that should handle this ticket")
    required_skills: RequiredSkills = Field(description="Skills required to handle the ticket")
    reasoning: str = Field(description="Explanation for the classification decision")
    needs_more_info: bool = Field(description="Whether more information is needed from the user")
    estimated_complexity: str = Field(description="Estimated complexity: simple, medium, complex")
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
        """Get teams data from PostgREST with caching and error handling."""
        current_time = datetime.now().timestamp()
        
        # Return cached data if valid
        if not force_refresh and self._teams_cache and self._teams_cache_timestamp:
            if current_time - self._teams_cache_timestamp < self._cache_ttl:
                return self._teams_cache
        
        try:
            # Fetch fresh data from PostgREST
            response = await self.postgrest.from_("teams").select("*").execute()
            
            if not response.data:
                logger.warning("No teams found in database, using default team")
                return [TeamData.get_default_team()]
            
            # Parse and cache the teams data
            teams = [TeamData(**team_data) for team_data in response.data]
            self._teams_cache = teams
            self._teams_cache_timestamp = current_time
            
            return teams
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching teams: {str(e)}")
            if self._teams_cache:
                logger.info("Using cached team data due to HTTP error")
                return self._teams_cache
            return [TeamData.get_default_team()]
            
        except Exception as e:
            logger.error(f"Unexpected error fetching teams: {str(e)}")
            if self._teams_cache:
                logger.info("Using cached team data due to unexpected error")
                return self._teams_cache
            return [TeamData.get_default_team()]

    def _calculate_team_match_score(
        self,
        team: TeamData,
        category: str,
        required_skills: RequiredSkills,
        ticket_tags: List[str]
    ) -> float:
        """Calculate how well a team matches the ticket requirements."""
        score = 0.0
        
        # Check focus area match
        if team.metadata.get("focus_area", {}).get("value") == category.lower():
            score += 0.4
        elif team.metadata.get("focus_area", {}).get("value") == "general":
            score += 0.1
        
        # Check skills match
        team_skills = set(team.metadata.get("Skills", []))
        required_skills_set = set(required_skills.tools_expertise)
        if required_skills_set and team_skills:
            skills_match_ratio = len(team_skills & required_skills_set) / len(required_skills_set)
            score += 0.3 * skills_match_ratio
        
        # Check technical level match
        if team.metadata.get("technical_level") == required_skills.technical_level:
            score += 0.3
        
        # Bonus for tag matches
        team_tags = set(team.metadata.get("tags", []))
        ticket_tags_set = set(ticket_tags)
        if ticket_tags_set and team_tags:
            tag_match_ratio = len(team_tags & ticket_tags_set) / len(ticket_tags_set)
            score += 0.1 * tag_match_ratio
        
        return min(score, 1.0)

    async def _determine_routing_team(
        self,
        category: str,
        required_skills: RequiredSkills,
        ticket_tags: List[str],
        can_auto_resolve: bool
    ) -> Tuple[TeamData, float]:
        """Determine the appropriate team for routing using PostgREST team data. Returns team and match score."""
        try:
            teams = await self._get_teams()
            
            if can_auto_resolve:
                # Find auto-resolution team
                auto_teams = [t for t in teams if t.metadata.get("focus_area", {}).get("value") == "auto_resolution"]
                if auto_teams:
                    return auto_teams[0], 1.0
            
            # Calculate match scores for each team
            team_scores = [
                (team, self._calculate_team_match_score(team, category, required_skills, ticket_tags))
                for team in teams
            ]
            
            # Sort by score and get best match
            best_team, score = max(team_scores, key=lambda x: x[1])
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
    ) -> tuple[bool, float, Optional[List[str]]]:
        """Analyze if the ticket can be auto-resolved based on patterns and similar tickets."""
        # Auto-resolvable patterns
        auto_resolvable_patterns = {
            "password_reset": ["reset password", "forgot password", "change password"],
            "account_activation": ["activate account", "account activation"],
            "basic_troubleshooting": ["clear cache", "refresh browser", "restart application"]
        }
        
        # Check for exact matches in similar tickets
        similar_auto_resolved = [t for t in similar_tickets if t.auto_resolved]
        if similar_auto_resolved:
            most_similar = similar_auto_resolved[0]
            if most_similar.similarity_score > 0.9:
                return True, most_similar.similarity_score, most_similar.resolution_steps
        
        # Check patterns
        text = f"{ticket.title.lower()} {ticket.description.lower()}"
        for category, patterns in auto_resolvable_patterns.items():
            if any(pattern in text for pattern in patterns):
                if ticket.metadata.Issue_Category.lower() == category:
                    return True, 0.85, self._get_standard_resolution_steps(category)
        
        return False, 0.0, None
    
    def _get_standard_resolution_steps(self, category: str) -> List[str]:
        """Get standard resolution steps for common categories."""
        resolution_steps = {
            "password_reset": [
                "Verify user identity",
                "Generate password reset link",
                "Send reset email",
                "Confirm reset completion"
            ],
            "account_activation": [
                "Verify account exists",
                "Generate activation link",
                "Send activation email",
                "Confirm activation"
            ],
            "basic_troubleshooting": [
                "Provide clear cache instructions",
                "Guide through browser refresh",
                "Verify issue resolution",
                "Offer additional support if needed"
            ]
        }
        return resolution_steps.get(category, [])
    
    def _determine_required_skills(
        self,
        ticket: TicketData,
        similar_tickets: List[SimilarTicket]
    ) -> RequiredSkills:
        """Determine required skills based on ticket content and similar tickets."""
        # Extract technical terms and entities
        technical_terms = set(ticket.metadata.technical_terms)
        entities = set(ticket.metadata.key_entities)
        
        # Analyze complexity
        complex_indicators = {
            "senior": ["architecture", "design", "scale", "performance", "security"],
            "mid": ["api", "integration", "database", "workflow"],
            "junior": ["ui", "typo", "display", "basic"]
        }
        
        text = f"{ticket.title.lower()} {ticket.description.lower()}"
        
        # Determine technical level
        technical_level = "junior"
        for level, indicators in complex_indicators.items():
            if any(indicator in text for indicator in indicators):
                technical_level = level
                break
        
        # Determine domain knowledge from similar tickets
        domain_knowledge = set()
        for t in similar_tickets:
            if t.metadata and "domain" in t.metadata:
                domain_knowledge.update(t.metadata["domain"])
        
        return RequiredSkills(
            technical_level=technical_level,
            domain_knowledge=list(domain_knowledge) if domain_knowledge else ["general"],
            tools_expertise=list(technical_terms) if technical_terms else ["basic_support_tools"]
        )
    
    @traceable(name="Classify Ticket")
    async def classify_ticket(
        self,
        ticket: TicketData,
        similar_tickets: List[SimilarTicket]
    ) -> ClassificationDecision:
        """Classify ticket and determine routing."""
        try:
            # Analyze auto-resolution potential
            can_auto_resolve, confidence, auto_steps = self._analyze_auto_resolution_potential(
                ticket, similar_tickets
            )
            
            # Determine required skills
            required_skills = self._determine_required_skills(ticket, similar_tickets)
            
            # Format similar tickets for LLM analysis
            similar_tickets_text = self._format_similar_tickets(similar_tickets)
            
            # Get LLM analysis for routing and complexity
            llm_response = await self.llm.ainvoke(
                self.classify_prompt.format_messages(
                    title=ticket.title,
                    description=ticket.description,
                    priority=ticket.priority,
                    category=ticket.metadata.Issue_Category,
                    tags=ticket.metadata.ticket_tags,
                    similar_tickets=similar_tickets_text
                )
            )
            
            # Extract complexity from LLM response
            response_text = llm_response.content.lower()
            complexity = "complex" if "complex" in response_text else "medium" if "medium" in response_text else "simple"
            
            # Determine routing team based on category and skills
            routing_team, team_match_score = await self._determine_routing_team(
                ticket.metadata.Issue_Category,
                required_skills,
                ticket.metadata.ticket_tags,
                can_auto_resolve
            )
            
            # Adjust confidence based on team match score
            confidence = min(confidence, team_match_score)
            
            # Check if more information is needed
            needs_more_info = (
                "unclear" in response_text or
                "more information" in response_text or
                "need clarification" in response_text
            )
            
            return ClassificationDecision(
                can_auto_resolve=can_auto_resolve,
                confidence_score=confidence,
                routing_team=routing_team,
                required_skills=required_skills,
                reasoning=llm_response.content,
                needs_more_info=needs_more_info,
                estimated_complexity=complexity,
                auto_resolution_steps=auto_steps if can_auto_resolve else None
            )
            
        except Exception as e:
            logger.error(f"Error in classify_ticket: {str(e)}")
            # Return a safe fallback classification
            return ClassificationDecision(
                can_auto_resolve=False,
                confidence_score=0.1,
                routing_team=TeamData.get_default_team(),
                required_skills=RequiredSkills(
                    technical_level="junior",
                    domain_knowledge=["general"],
                    tools_expertise=["basic_support_tools"]
                ),
                reasoning=f"Error during classification: {str(e)}. Routing to general support.",
                needs_more_info=True,
                estimated_complexity="medium",
                auto_resolution_steps=None
            ) 