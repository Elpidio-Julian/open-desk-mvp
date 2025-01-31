import asyncio
import os
from dotenv import load_dotenv
from services.ticket_agent import TicketAgent
from supabase_client import SupabaseClient

async def test_ticket_agent():
    """Test the ticket agent with real tickets from Supabase."""
    # Load environment variables
    load_dotenv()
    
    # Initialize Supabase client and ticket agent
    supabase = SupabaseClient()
    agent = TicketAgent()
    
    try:
        # Fetch a few test tickets from Supabase
        response = supabase.client.from_("tickets").select("id").limit(3).execute()
        test_tickets = response.data
        
        print(f"Found {len(test_tickets)} tickets to test\n")
        
        # Process each ticket
        for ticket in test_tickets:
            print(f"\nProcessing ticket {ticket['id']}:")
            print("-" * 50)
            
            # Process the ticket
            result = await agent.process_ticket(ticket['id'])
            
            # Print results
            print("\nResults:")
            print(f"Can auto-resolve: {result['can_auto_resolve']}")
            print(f"Confidence: {result['confidence']:.2f}")
            print("\nProcessing log:")
            for message in result['processing_log']:
                print(f"- {message}")
            print("-" * 50)
    
    except Exception as e:
        print(f"Error during testing: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_ticket_agent()) 