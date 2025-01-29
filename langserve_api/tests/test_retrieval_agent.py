import pytest
from unittest.mock import Mock, patch
from uuid import uuid4
from agents.retrieval_agent import RetrievalAgent, SimilarTicket
from langchain_community.vectorstores import Chroma
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

@pytest.fixture(autouse=True)
def env_setup():
    """Ensure required environment variables are set."""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("Missing OPENAI_API_KEY environment variable")

@pytest.fixture
def mock_vector_store():
    return Mock(spec=Chroma)

@pytest.fixture
def sample_tickets():
    return [
        {
            "ticket_id": str(uuid4()),
            "content": "API authentication failing with 500 error",
            "solution": "Fixed API token validation logic",
            "resolution": "1. Checked logs\n2. Found invalid token format\n3. Updated validation",
            "auto_resolved": False,
            "resolution_time": 2.5,
            "success_rate": 0.95,
            "metadata": {"category": "api", "priority": "high"}
        },
        {
            "ticket_id": str(uuid4()),
            "content": "Need to reset my password",
            "solution": "Sent password reset email",
            "resolution": "Generated and sent reset link",
            "auto_resolved": True,
            "resolution_time": 0.1,
            "success_rate": 1.0,
            "metadata": {"category": "account", "priority": "low"}
        }
    ]

@pytest.mark.asyncio
async def test_add_ticket(mock_vector_store):
    """Test adding a ticket to the vector store."""
    agent = RetrievalAgent(mock_vector_store)
    
    ticket = {
        "ticket_id": "test-123",
        "content": "Test ticket content",
        "solution": "Test solution",
        "resolution": "Test resolution steps",
        "auto_resolved": True,
        "resolution_time": 0.5,
        "success_rate": 0.9,
        "metadata": {"test": "metadata"}
    }
    
    await agent.add_ticket(
        ticket_id=ticket["ticket_id"],
        content=ticket["content"],
        solution=ticket["solution"],
        resolution=ticket["resolution"],
        auto_resolved=ticket["auto_resolved"],
        resolution_time=ticket["resolution_time"],
        success_rate=ticket["success_rate"],
        metadata=ticket["metadata"]
    )
    
    # Verify the ticket was added correctly
    mock_vector_store.aadd_texts.assert_called_once()
    call_args = mock_vector_store.aadd_texts.call_args[1]
    
    assert call_args["texts"] == [ticket["content"]]
    metadata = call_args["metadatas"][0]
    assert metadata["ticket_id"] == ticket["ticket_id"]
    assert metadata["solution"] == ticket["solution"]
    assert metadata["resolution"] == ticket["resolution"]
    assert metadata["auto_resolved"] == ticket["auto_resolved"]
    assert metadata["resolution_time"] == ticket["resolution_time"]
    assert metadata["success_rate"] == ticket["success_rate"]
    assert metadata["test"] == "metadata"

@pytest.mark.asyncio
async def test_find_similar_tickets(mock_vector_store, sample_tickets):
    """Test finding similar tickets."""
    agent = RetrievalAgent(mock_vector_store)
    
    # Mock the vector store search results
    mock_results = []
    for ticket in sample_tickets:
        doc = Mock()
        doc.page_content = ticket["content"]
        doc.metadata = {
            "ticket_id": ticket["ticket_id"],
            "solution": ticket["solution"],
            "resolution": ticket["resolution"],
            "auto_resolved": ticket["auto_resolved"],
            "resolution_time": ticket["resolution_time"],
            "success_rate": ticket["success_rate"],
            **ticket["metadata"]
        }
        mock_results.append((doc, 0.9))
    
    mock_vector_store.asimilarity_search_with_relevance_scores.return_value = mock_results
    
    # Search for similar tickets
    results = await agent.find_similar_tickets(
        query="API error",
        n_results=2,
        similarity_threshold=0.8
    )
    
    # Verify the search was performed correctly
    mock_vector_store.asimilarity_search_with_relevance_scores.assert_called_once_with(
        "API error",
        k=2
    )
    
    # Verify the results
    assert len(results) == 2
    for result, sample in zip(results, sample_tickets):
        assert isinstance(result, SimilarTicket)
        assert result.ticket_id == sample["ticket_id"]
        assert result.content == sample["content"]
        assert result.solution == sample["solution"]
        assert result.resolution == sample["resolution"]
        assert result.auto_resolved == sample["auto_resolved"]
        assert result.resolution_time == sample["resolution_time"]
        assert result.success_rate == sample["success_rate"]
        assert result.metadata == sample["metadata"]

@pytest.mark.asyncio
async def test_update_ticket_solution(mock_vector_store):
    """Test updating a ticket's solution."""
    agent = RetrievalAgent(mock_vector_store)
    
    # Mock finding the existing ticket
    doc = Mock()
    doc.page_content = "Original content"
    doc.metadata = {
        "ticket_id": "test-123",
        "solution": "Old solution",
        "success_rate": 0.5,
        "category": "test"
    }
    mock_vector_store.asimilarity_search_with_relevance_scores.return_value = [(doc, 0.9)]
    
    # Update the solution
    await agent.update_ticket_solution(
        ticket_id="test-123",
        solution="New solution",
        success_rate=0.9,
        auto_resolved=True,
        resolution_time=0.5
    )
    
    # Verify the old document was deleted
    mock_vector_store.adelete.assert_called_once_with(["test-123"])
    
    # Verify the new document was added
    mock_vector_store.aadd_texts.assert_called_once()
    call_args = mock_vector_store.aadd_texts.call_args[1]
    
    assert call_args["texts"] == ["Original content"]
    metadata = call_args["metadatas"][0]
    assert metadata["ticket_id"] == "test-123"
    assert metadata["solution"] == "New solution"
    assert metadata["success_rate"] == 0.9
    assert metadata["auto_resolved"] == True
    assert metadata["resolution_time"] == 0.5
    assert metadata["category"] == "test"

@pytest.mark.asyncio
async def test_find_similar_tickets_below_threshold(mock_vector_store):
    """Test that tickets below similarity threshold are filtered out."""
    agent = RetrievalAgent(mock_vector_store)
    
    # Mock results with varying similarity scores
    doc1, doc2 = Mock(), Mock()
    doc1.page_content = "Content 1"
    doc2.page_content = "Content 2"
    doc1.metadata = {"ticket_id": "1", "solution": "Solution 1", "success_rate": 0.8}
    doc2.metadata = {"ticket_id": "2", "solution": "Solution 2", "success_rate": 0.9}
    
    mock_vector_store.asimilarity_search_with_relevance_scores.return_value = [
        (doc1, 0.9),  # Above threshold
        (doc2, 0.6)   # Below threshold
    ]
    
    results = await agent.find_similar_tickets(
        query="test",
        similarity_threshold=0.8
    )
    
    assert len(results) == 1
    assert results[0].ticket_id == "1"
    assert results[0].similarity_score == 0.9 