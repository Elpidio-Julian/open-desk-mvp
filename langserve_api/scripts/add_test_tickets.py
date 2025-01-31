import asyncio
import os
from dotenv import load_dotenv
from ..services.vector_store import VectorStore
from supabase_client import SupabaseClient

async def add_test_tickets():
    """Add test tickets to the vector store."""
    # Load environment variables
    load_dotenv()
    
    # Initialize clients
    supabase = SupabaseClient()
    vector_store = VectorStore()
    
    try:
        # Fetch all tickets from Supabase
        response = supabase.client.from_("tickets").select("*").execute()
        tickets = response.data
        
        print(f"Found {len(tickets)} tickets to add to vector store")
        
        # Add each ticket to vector store
        for ticket in tickets:
            # Combine title and description for content
            content = f"{ticket.get('title', '')} {ticket.get('description', '')}"
            
            # Create metadata
            metadata = {
                "ticket_id": ticket["id"],
                "creator_id": ticket["creator_id"],
                "category": ticket.get("metadata", {}).get("Issue Category", "unknown"),
                "status": ticket["status"],
                "priority": ticket["priority"]
            }
            
            # Add to vector store
            print(f"\nAdding ticket {ticket['id']} to vector store")
            print(f"Content: {content}")
            print(f"Metadata: {metadata}")
            
            await vector_store.add_document(
                ticket_id=ticket["id"],
                content=content,
                metadata=metadata
            )
        
        print("\nAll tickets added to vector store successfully")
    
    except Exception as e:
        print(f"Error adding tickets: {str(e)}")

if __name__ == "__main__":
    asyncio.run(add_test_tickets()) 