import asyncio
import os
from dotenv import load_dotenv
from services.ticket_tools import ClassificationTool
from services.vector_store import VectorStore
from supabase_client import SupabaseClient

async def test_classification():
    """Test ticket classification with different scenarios."""
    # Load environment variables
    load_dotenv()
    
    # Initialize tools
    vector_store = VectorStore()
    classifier = ClassificationTool(vector_store)
    
    # Test cases
    test_tickets = [
        {
            "title": "Need to reset my password",
            "description": "I forgot my password and need to reset it. Can you help?",
            "priority": "low",
            "status": "new",
            "metadata": {
                "Issue Category": "Account Management",
                "tags": ["password", "reset"]
            }
        },
        {
            "title": "Update my profile name",
            "description": "I need to change my full name in my profile from John Doe to John Smith",
            "priority": "low",
            "status": "new",
            "metadata": {
                "Issue Category": "Account Management",
                "tags": ["profile", "name-change"]
            }
        },
        {
            "title": "How do I export my data?",
            "description": "Looking for information on how to export my account data. No changes needed, just need the steps.",
            "priority": "low",
            "status": "new",
            "metadata": {
                "Issue Category": "Information Request",
                "tags": ["export", "data"]
            }
        },
        {
            "title": "Need database access",
            "description": "I need access to the production database for my new role",
            "priority": "low",
            "status": "new",
            "metadata": {
                "Issue Category": "Access Request",
                "tags": ["access", "database"]
            }
        },
        {
            "title": "System is completely down",
            "description": "Cannot access any features, getting 500 error",
            "priority": "urgent",
            "status": "new",
            "metadata": {
                "Issue Category": "System Issue",
                "tags": ["system-down", "error"]
            }
        },
        {
            "title": "Feature request: Dark mode",
            "description": "Would be great to have a dark mode option",
            "priority": "low",
            "status": "new",
            "metadata": {
                "Issue Category": "Feature Request",
                "tags": ["feature", "ui"]
            }
        }
    ]
    
    print("Starting classification tests...")
    print("=" * 50)
    
    for i, ticket in enumerate(test_tickets, 1):
        print(f"\nTest Case {i}: {ticket['title']}")
        print("-" * 50)
        print(f"Description: {ticket['description']}")
        print(f"Priority: {ticket['priority']}")
        print(f"Metadata: {ticket['metadata']}")
        
        result = await classifier.classify_ticket(ticket)
        
        print("\nClassification Result:")
        print(f"Can auto-resolve: {result['can_auto_resolve']}")
        print(f"Confidence: {result.get('confidence', 0):.2f}")
        print(f"Reason: {result.get('reason', 'unknown')}")
        if result.get('matching_rule'):
            print(f"Matching rule: {result['matching_rule']}")
        if result.get('error'):
            print(f"Error: {result['error']}")
        print("=" * 50)

if __name__ == "__main__":
    asyncio.run(test_classification()) 