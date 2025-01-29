import pytest
from uuid import UUID
from datetime import datetime
from typing import Dict, Any

from agents.ingestion_agent import IngestionAgent, AgentState
from agents.models import TicketData, TicketMetadata
from .test_helpers import debug_ticket_processing, compare_metadata

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

# Test individual nodes
@pytest.mark.asyncio
async def test_process_ticket_node(ingestion_agent, sample_tickets):
    """Test the process_ticket node in isolation."""
    ticket = sample_tickets[0]
    initial_state: AgentState = {
        "ticket": {"title": ticket["title"], "description": ticket["description"]},
        "metadata": {},
        "context": {},
        "processed_ticket": None,
        "error": None,
        "status": "started"
    }
    
    result_state = await ingestion_agent._process_ticket_node(initial_state)
    
    assert result_state["status"] == "processed", "Status should be 'processed'"
    assert result_state["error"] is None, "No error should be present"
    assert isinstance(result_state["processed_ticket"], TicketData), "Should have processed ticket"
    assert result_state["processed_ticket"].title == ticket["title"], "Title should match"
    assert result_state["processed_ticket"].priority == ticket["expected_priority"], "Priority should match"

@pytest.mark.asyncio
async def test_merge_metadata_node(ingestion_agent, sample_tickets, sample_metadata):
    """Test the merge_metadata node in isolation."""
    ticket = sample_tickets[0]
    processed_ticket = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    initial_state: AgentState = {
        "ticket": {"title": ticket["title"], "description": ticket["description"]},
        "metadata": sample_metadata,
        "context": {},
        "processed_ticket": processed_ticket,
        "error": None,
        "status": "processed"
    }
    
    result_state = await ingestion_agent._merge_metadata_node(initial_state)
    
    assert result_state["status"] == "completed", "Status should be 'completed'"
    assert result_state["error"] is None, "No error should be present"
    assert result_state["processed_ticket"].metadata.platform == sample_metadata["platform"], "Platform should be preserved"
    assert "existing_tag" in result_state["processed_ticket"].metadata.ticket_tags, "Existing tags should be preserved"

@pytest.mark.asyncio
async def test_error_handling_node(ingestion_agent):
    """Test the error handling node in isolation."""
    error_state: AgentState = {
        "ticket": {"title": "Test", "description": ""},
        "metadata": {},
        "context": {},
        "processed_ticket": None,
        "error": "Test error",
        "status": "error"
    }
    
    result_state = await ingestion_agent._handle_error_node(error_state)
    
    assert result_state["status"] == "completed", "Status should be 'completed'"
    assert isinstance(result_state["processed_ticket"], TicketData), "Should have fallback ticket"
    assert result_state["processed_ticket"].priority == "medium", "Should use medium priority for fallback"

# Test complete workflow
@pytest.mark.asyncio
async def test_process_ticket_basic(ingestion_agent, sample_tickets):
    """Test basic ticket processing without metadata or context."""
    ticket = sample_tickets[0]
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    debug_info = debug_ticket_processing(
        ticket["title"],
        ticket["description"],
        result,
        ticket
    )
    
    assert isinstance(result, TicketData), "Result should be TicketData instance"
    assert result.title == ticket["title"], "Title should match"
    assert result.description == ticket["description"], "Description should match"
    assert result.priority == ticket["expected_priority"], f"Priority mismatch.\n{debug_info}"
    assert result.metadata.Issue_Category == ticket["expected_category"], f"Category mismatch.\n{debug_info}"
    
    # Check if tags were generated
    tag_matches = [tag in result.metadata.ticket_tags for tag in ticket["expected_tags"]]
    assert any(tag_matches), f"No expected tags found.\nExpected one of: {ticket['expected_tags']}\nGot: {result.metadata.ticket_tags}"
    
    term_matches = [term in result.metadata.technical_terms for term in ticket["expected_technical_terms"]]
    assert any(term_matches), f"No expected technical terms found.\nExpected one of: {ticket['expected_technical_terms']}\nGot: {result.metadata.technical_terms}"

@pytest.mark.asyncio
async def test_process_ticket_with_metadata(ingestion_agent, sample_tickets, sample_metadata):
    """Test ticket processing with existing metadata."""
    ticket = sample_tickets[0]
    result = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"],
        existing_metadata=sample_metadata
    )
    
    debug_info = debug_ticket_processing(
        ticket["title"],
        ticket["description"],
        result,
        ticket
    )
    
    # Check if existing metadata was preserved where appropriate
    assert result.metadata.platform == sample_metadata["platform"], "Platform should be preserved"
    assert "existing_tag" in result.metadata.ticket_tags, "Existing tags should be preserved"
    
    # Check if new metadata was added
    tag_matches = [tag in result.metadata.ticket_tags for tag in ticket["expected_tags"]]
    assert any(tag_matches), f"No expected tags were added.\nExpected one of: {ticket['expected_tags']}\nGot: {result.metadata.ticket_tags}\n{debug_info}"

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
    
    debug_info = debug_ticket_processing(
        ticket["title"],
        ticket["description"],
        result,
        ticket
    )
    
    assert result.creator_id == UUID(context["creator_id"]), f"Creator ID not set correctly.\n{debug_info}"

@pytest.mark.asyncio
async def test_prepare_for_vectordb(ingestion_agent, sample_tickets):
    """Test preparation of ticket for vector storage."""
    ticket = sample_tickets[0]
    processed_ticket = await ingestion_agent.process_ticket(
        title=ticket["title"],
        description=ticket["description"]
    )
    
    vector_data = await ingestion_agent.prepare_for_vectordb(processed_ticket)
    
    assert "id" in vector_data, "Vector data should have ID"
    assert "text" in vector_data, "Vector data should have text"
    assert "metadata" in vector_data, "Vector data should have metadata"
    assert "embeddings" in vector_data, "Vector data should have embeddings"
    assert isinstance(vector_data["embeddings"], list), "Embeddings should be a list"
    
    # Check if important fields are included in the text
    text = vector_data["text"].lower()
    assert ticket["title"].lower() in text, f"Title not found in embedding text: {text}"
    assert ticket["description"].lower() in text, f"Description not found in embedding text: {text}"
    assert any(tag.lower() in text for tag in ticket["expected_tags"]), f"No tags found in embedding text: {text}"

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
    assert ticket["title"] in embedding_text, f"Title missing from embedding text: {embedding_text}"
    assert ticket["description"] in embedding_text, f"Description missing from embedding text: {embedding_text}"
    assert "category:" in embedding_text.lower(), f"Category missing from embedding text: {embedding_text}"

@pytest.mark.asyncio
async def test_process_ticket_error_handling(ingestion_agent):
    """Test error handling with malformed input."""
    # Test with empty description
    result = await ingestion_agent.process_ticket(
        title="Test",
        description=""
    )
    assert isinstance(result, TicketData), "Should return TicketData even with empty description"
    assert result.priority == "medium", "Should use fallback priority for empty description"
    
    # Test with very long input
    long_description = "test " * 1000
    result = await ingestion_agent.process_ticket(
        title="Test Long",
        description=long_description
    )
    assert isinstance(result, TicketData), "Should handle long descriptions"
    assert result.description == long_description, "Should preserve long description"

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
    
    debug_info = debug_ticket_processing(
        ticket["title"],
        ticket["description"],
        result,
        ticket
    )
    
    assert result.priority == expected_priority, f"Priority mismatch for ticket type.\n{debug_info}" 