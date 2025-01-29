import pytest
from uuid import UUID
from datetime import datetime
from typing import Dict, Any

from agents.ingestion_agent import IngestionAgent, TicketData, TicketMetadata

# Test data fixtures
@pytest.fixture
def sample_tickets():
    return [
        {
            "title": "Cannot login to dashboard",
            "description": "Getting 403 error when trying to access admin dashboard on Chrome",
            "expected_priority": "high",
            "expected_category": "Authentication",
            "expected_tags": ["login", "error", "dashboard", "access"],
            "expected_technical_terms": ["403", "admin dashboard"]
        },
        {
            "title": "Feature request: Dark mode",
            "description": "Would like to request dark mode for the application UI",
            "expected_priority": "low",
            "expected_category": "Feature Request",
            "expected_tags": ["ui", "dark mode", "feature request"],
            "expected_technical_terms": ["ui"]
        },
        {
            "title": "System slow during peak hours",
            "description": "Database queries taking 30s to load between 2-4pm EST",
            "expected_priority": "medium",
            "expected_category": "Performance",
            "expected_tags": ["performance", "database", "slow"],
            "expected_technical_terms": ["database queries", "30s"]
        }
    ]

@pytest.fixture
def sample_metadata():
    return {
        "Issue_Category": "Bug",
        "browser": "Firefox",
        "platform": "Windows",
        "ticket_tags": ["existing_tag"]
    }

@pytest.fixture
def ingestion_agent():
    return IngestionAgent()

# Test ticket processing
@pytest.mark.asyncio
async def test_process_ticket_basic(ingestion_agent, sample_tickets):
    """Test basic ticket processing without metadata or context."""
    ticket = sample_tickets[0]
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    assert isinstance(result, TicketData)
    assert result.title == ticket["title"]
    assert result.description == ticket["description"]
    assert result.priority == ticket["expected_priority"]
    assert result.metadata.Issue_Category == ticket["expected_category"]
    
    # Check if tags were generated
    assert any(tag in result.metadata.ticket_tags for tag in ticket["expected_tags"])
    assert any(term in result.metadata.technical_terms for term in ticket["expected_technical_terms"])

@pytest.mark.asyncio
async def test_process_ticket_with_metadata(ingestion_agent, sample_tickets, sample_metadata):
    """Test ticket processing with existing metadata."""
    ticket = sample_tickets[0]
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"],
        existing_metadata=sample_metadata
    )
    
    # Check if existing metadata was preserved
    assert result.metadata.browser == sample_metadata["browser"]
    assert result.metadata.platform == sample_metadata["platform"]
    assert "existing_tag" in result.metadata.ticket_tags
    
    # Check if new metadata was added
    assert any(tag in result.metadata.ticket_tags for tag in ticket["expected_tags"])

@pytest.mark.asyncio
async def test_process_ticket_with_context(ingestion_agent, sample_tickets):
    """Test ticket processing with context information."""
    ticket = sample_tickets[0]
    context = {
        "creator_id": "8284f8bf-3228-410d-912e-e5ea21546b94",
        "subscription_tier": "premium"
    }
    
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"],
        context=context
    )
    
    assert result.creator_id == UUID(context["creator_id"])

# Test vector preparation
@pytest.mark.asyncio
async def test_prepare_for_vectordb(ingestion_agent, sample_tickets):
    """Test preparation of ticket for vector storage."""
    ticket = sample_tickets[0]
    processed_ticket = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    vector_data = await ingestion_agent.prepare_for_vectordb(processed_ticket)
    
    assert "id" in vector_data
    assert "text" in vector_data
    assert "metadata" in vector_data
    assert "embeddings" in vector_data
    assert isinstance(vector_data["embeddings"], list)
    
    # Check if important fields are included in the text
    text = vector_data["text"].lower()
    assert ticket["title"].lower() in text
    assert ticket["description"].lower() in text
    assert any(tag.lower() in text for tag in ticket["expected_tags"])

@pytest.mark.asyncio
async def test_embedding_text_format(ingestion_agent, sample_tickets):
    """Test the format of text prepared for embeddings."""
    ticket = sample_tickets[0]
    processed_ticket = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    embedding_text = processed_ticket.get_text_for_embedding()
    
    # Check if all important information is included
    assert ticket["title"] in embedding_text
    assert ticket["description"] in embedding_text
    assert "priority:" in embedding_text
    assert "category:" in embedding_text
    
    # Check if technical terms are included
    assert any(term in embedding_text for term in ticket["expected_technical_terms"])

# Test error handling
@pytest.mark.asyncio
async def test_process_ticket_error_handling(ingestion_agent):
    """Test error handling with malformed input."""
    # Test with empty description
    result = await ingestion_agent.process_ticket(
        title="Test",
        description=""
    )
    assert isinstance(result, TicketData)
    assert result.priority == "medium"  # Should use fallback
    
    # Test with very long input
    long_description = "test " * 1000
    result = await ingestion_agent.process_ticket(
        title="Test",
        description=long_description
    )
    assert isinstance(result, TicketData)
    
# Test priority assessment
@pytest.mark.asyncio
@pytest.mark.parametrize("ticket_index,expected_priority", [
    (0, "high"),    # Login issue
    (1, "low"),     # Feature request
    (2, "medium")   # Performance issue
])
async def test_priority_assessment(ingestion_agent, sample_tickets, ticket_index, expected_priority):
    """Test priority assessment for different ticket types."""
    ticket = sample_tickets[ticket_index]
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    assert result.priority == expected_priority 