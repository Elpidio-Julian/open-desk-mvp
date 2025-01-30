import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from uuid import uuid4
from agents.classifier_agent import (
    ClassifierAgent,
    TeamData,
    RequiredSkills,
    ClassificationDecision,
    SupabaseConnectionError
)
from agents.ingestion_agent import TicketData, TicketMetadata
from agents.retrieval_agent import SimilarTicket, RetrievalAgent
import os
from dotenv import load_dotenv
import asyncio
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

@pytest.fixture(autouse=True)
def env_setup():
    """Ensure required environment variables are set."""
    required_vars = [
        "OPENAI_API_KEY",
        "VITE_PROD_SUPABASE_URL",
        "VITE_PROD_SUPABASE_ANON_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        pytest.skip(f"Missing required environment variables: {', '.join(missing_vars)}")

@pytest.fixture
def mock_retrieval_agent():
    return Mock(spec=RetrievalAgent)

@pytest.fixture
def sample_tickets():
    return [
        # Technical ticket
        {
            "title": "API Integration Error",
            "description": "Getting 500 errors when calling the user management API",
            "priority": "high",
            "category": "Technical",
            "tags": ["api", "error", "integration"],
            "expected_team": "Engineering Team",
            "expected_level": "senior",
            "can_auto_resolve": False
        },
        # Password reset ticket
        {
            "title": "Password Reset Required",
            "description": "I forgot my password and need to reset it",
            "priority": "low",
            "category": "password_reset",
            "tags": ["password", "reset", "account"],
            "expected_team": "Auto Resolution",
            "expected_level": "junior",
            "can_auto_resolve": True
        },
        # Unclear ticket
        {
            "title": "Issue with the system",
            "description": "It's not working properly",
            "priority": "medium",
            "category": "Technical",
            "tags": ["error"],
            "expected_team": "General Support",
            "expected_level": "junior",
            "needs_more_info": True,
            "can_auto_resolve": False
        }
    ]

@pytest.fixture
def mock_teams_data():
    return [
        TeamData(
            id=str(uuid4()),
            name="Engineering Team",
            description="Technical issue resolution",
            metadata={
                "focus_area": {"value": "technical", "label": "Technical Support"},
                "Skills": ["api", "database", "backend"],
                "technical_level": "senior",
                "tags": ["technical", "engineering"]
            },
            created_at=datetime.now(),
            updated_at=datetime.now()
        ),
        TeamData(
            id=str(uuid4()),
            name="General Support",
            description="General customer support",
            metadata={
                "focus_area": {"value": "general", "label": "General Support"},
                "Skills": ["customer service", "basic troubleshooting"],
                "technical_level": "junior",
                "tags": ["support", "customer"]
            },
            created_at=datetime.now(),
            updated_at=datetime.now()
        ),
        TeamData(
            id=str(uuid4()),
            name="Auto Resolution",
            description="Automated ticket resolution",
            metadata={
                "focus_area": {"value": "auto_resolution", "label": "Auto Resolution"},
                "Skills": ["automation"],
                "technical_level": "junior",
                "tags": ["auto", "automated"]
            },
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
    ]

def create_ticket_data(ticket_info: dict) -> TicketData:
    """Helper function to create TicketData from test info."""
    return TicketData(
        title=ticket_info["title"],
        description=ticket_info["description"],
        priority=ticket_info["priority"],
        status="new",
        metadata=TicketMetadata(
            Issue_Category=ticket_info["category"],
            ticket_tags=ticket_info["tags"],
            technical_terms=[],  # Will be filled by the agent
            key_entities=[],     # Will be filled by the agent
            browser="Chrome",    # Not relevant for classification
            platform="Windows"   # Not relevant for classification
        )
    )

class AsyncMock(Mock):
    """Mock class that supports async context managers and awaits."""
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, *args):
        pass
    
    async def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)

    def __await__(self):
        future = asyncio.Future()
        future.set_result(self)
        return future.__await__()

def create_similar_ticket(content: str, auto_resolved: bool = False) -> SimilarTicket:
    """Helper function to create similar ticket."""
    return SimilarTicket(
        ticket_id=str(uuid4()),
        content=content,
        resolution="Resolution steps here" if auto_resolved else "No resolution needed",
        solution="Standard solution" if auto_resolved else "No solution available",
        auto_resolved=auto_resolved,
        resolution_time=0.1 if auto_resolved else 4,
        similarity_score=0.95 if auto_resolved else 0.85,
        success_rate=0.95 if auto_resolved else 0.0,
        metadata={"domain": ["auth"] if auto_resolved else ["api"]}
    )

def setup_mock_postgrest(mock_postgrest, mock_teams_data):
    """Set up mock PostgREST client with proper async behavior."""
    print("\n=== Setting up mock PostgREST with", len(mock_teams_data), "teams ===")
    print(f"Mock response data: {[team.name for team in mock_teams_data]}")

    # Create mock response with actual data
    mock_response = AsyncMock()
    mock_response.data = mock_teams_data  # Set actual data instead of another mock
    print("Set up mock execute method")

    # Set up mock select method that returns the mock response
    mock_select = AsyncMock()
    mock_select.execute = AsyncMock(return_value=mock_response)
    print("Set up mock select method")

    # Set up mock from_ method that returns the mock select
    mock_from = Mock()
    mock_from.select = Mock(return_value=mock_select)
    print("Set up mock from_ method")

    # Set up mock client that returns the mock from_
    mock_client = Mock()
    mock_client.from_ = Mock(return_value=mock_from)
    print("Set up mock client")

    # Configure the mock_postgrest to return our mock client
    mock_postgrest.return_value = mock_client
    print("Completed mock PostgREST setup")

    return mock_client

@pytest.mark.asyncio
async def test_classifier_initialization(mock_retrieval_agent):
    """Test classifier agent initialization."""
    with patch('agents.classifier_agent.AsyncPostgrestClient') as mock_postgrest:
        mock_postgrest.return_value = AsyncMock()
        agent = ClassifierAgent(mock_retrieval_agent)
        assert agent.retrieval_agent == mock_retrieval_agent
        assert agent.llm is not None
        assert agent.postgrest is not None

@pytest.mark.asyncio
async def test_classifier_initialization_failure():
    """Test classifier agent initialization with PostgREST connection failure."""
    with patch('agents.classifier_agent.AsyncPostgrestClient') as mock_postgrest:
        mock_postgrest.side_effect = Exception("Connection failed")
        with pytest.raises(SupabaseConnectionError):
            ClassifierAgent(Mock(spec=RetrievalAgent))

@pytest.mark.asyncio
async def test_get_teams_success(mock_retrieval_agent, mock_teams_data):
    """Test successful team data retrieval."""
    print("\n=== Starting test_get_teams_success ===")
    print(f"Mock teams data: {[team.name for team in mock_teams_data]}")
    
    with patch('agents.classifier_agent.AsyncPostgrestClient') as mock_postgrest:
        # Set up mock PostgREST client
        mock_client = setup_mock_postgrest(mock_postgrest, mock_teams_data)
        print("Mock PostgREST client set up")
        
        # Create agent and get teams
        agent = ClassifierAgent(mock_retrieval_agent)
        print("Created ClassifierAgent")
        
        teams = await agent._get_teams(force_refresh=True)
        print(f"Retrieved teams: {[team.name for team in teams]}")
        
        # Verify the results
        assert len(teams) == len(mock_teams_data), f"Expected {len(mock_teams_data)} teams, got {len(teams)}"
        for actual, expected in zip(teams, mock_teams_data):
            assert actual.name == expected.name, f"Expected team name {expected.name}, got {actual.name}"
            assert actual.metadata == expected.metadata, f"Metadata mismatch for team {actual.name}"
    
    print("Completed test_get_teams_success")

@pytest.mark.asyncio
@pytest.mark.parametrize("ticket_index", [0, 1, 2])
async def test_end_to_end_classification(
    mock_retrieval_agent,
    mock_teams_data,
    sample_tickets,
    ticket_index
):
    """Test end-to-end ticket classification."""
    with patch('agents.classifier_agent.AsyncPostgrestClient') as mock_postgrest:
        setup_mock_postgrest(mock_postgrest, mock_teams_data)
        
        # Create agent and test data
        agent = ClassifierAgent(mock_retrieval_agent)
        ticket_info = sample_tickets[ticket_index]
        ticket = create_ticket_data(ticket_info)
        
        # Create similar tickets based on the test case
        similar_tickets = [
            create_similar_ticket(
                ticket_info["description"],
                auto_resolved=ticket_info["can_auto_resolve"]
            )
        ]
        
        # Classify ticket
        result = await agent.classify_ticket(ticket, similar_tickets)
        
        # Verify classification
        assert isinstance(result, ClassificationDecision)
        assert result.can_auto_resolve == ticket_info["can_auto_resolve"]
        assert result.routing_team.name == ticket_info["expected_team"]
        
        # Verify confidence score is reasonable
        assert 0 <= result.confidence_score <= 1
        
        # Verify auto-resolution steps if applicable
        if result.can_auto_resolve:
            assert result.auto_resolution_steps is not None

@pytest.mark.asyncio
async def test_team_match_scoring(mock_retrieval_agent, mock_teams_data):
    """Test team match scoring logic."""
    with patch('agents.classifier_agent.AsyncPostgrestClient') as mock_postgrest:
        mock_client = AsyncMock()
        mock_execute = AsyncMock()
        mock_execute.data = [team.model_dump() for team in mock_teams_data]
        mock_select = AsyncMock()
        mock_select.execute = mock_execute
        mock_from = AsyncMock()
        mock_from.select.return_value = mock_select
        mock_client.from_.return_value = mock_from
        mock_postgrest.return_value = mock_client
        
        agent = ClassifierAgent(mock_retrieval_agent)
        
        # Test exact category match
        score = agent._calculate_team_match_score(
            mock_teams_data[0],  # Engineering Team
            "Technical",
            ["api", "error"]
        )
        
        assert score >= 0.7  # High score for good match
        
        # Test general support fallback
        score_general = agent._calculate_team_match_score(
            mock_teams_data[1],  # General Support
            "Unknown",
            ["help", "support"]
        )
        
        assert 0.1 <= score_general <= 0.5  # Moderate score for general support 