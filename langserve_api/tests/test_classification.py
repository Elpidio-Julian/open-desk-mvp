import asyncio
from services.ticket_tools import ClassificationTool
from services.vector_store import VectorStore

async def test_classification():
    # Initialize tools
    vector_store = VectorStore()
    classifier = ClassificationTool(vector_store)
    
    # Test ticket that should be auto-resolvable (password reset)
    test_ticket = {
        "id": "test-123",
        "title": "Password Reset Request",
        "description": "I need to reset my password for my account",
        "priority": "medium",
        "status": "new",
        "metadata": {
            "Issue Category": "Account Management",
            "tags": ["password", "account"]
        }
    }
    
    # Test classification
    result = await classifier.classify_ticket(test_ticket)
    
    # Print results
    print("\nClassification Results:")
    print(f"Can auto-resolve: {result['can_auto_resolve']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Metadata updates: {result['metadata_updates']}")
    
    return result

if __name__ == "__main__":
    asyncio.run(test_classification()) 