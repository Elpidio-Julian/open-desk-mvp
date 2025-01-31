from typing import Dict, Any, TypedDict, List
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from services.ticket_tools import get_ticket_tools
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
from datetime import datetime
from supabase_client import SupabaseClient
from services.vector_store import VectorStore

class AgentState(TypedDict):
    """State for the ticket processing agent."""
    ticket_id: str
    ticket_data: Dict[str, Any]
    similar_tickets: List[Dict[str, Any]]
    can_auto_resolve: bool
    confidence: float
    messages: List[str]
    next_step: str
    metadata_updates: Dict[str, Any]  # Track changes to be made to metadata

class TicketAgent:
    """Agent for processing and classifying support tickets using a graph-based approach."""

    def __init__(self):
        self.vector_store = VectorStore()
        self.tools = get_ticket_tools(vector_store=self.vector_store)  # Pass vector_store to tools
        self.llm = ChatOpenAI(temperature=0)
        self.supabase = SupabaseClient()
        
        # Create the graph
        self.workflow = self._create_workflow()

    def _create_workflow(self) -> StateGraph:
        """Create the workflow graph for ticket processing."""
        
        # Initialize the graph
        workflow = StateGraph(AgentState)

        # Define the nodes
        workflow.add_node("retrieve_ticket", self._retrieve_ticket)
        workflow.add_node("find_similar", self._find_similar_tickets)
        workflow.add_node("classify", self._classify_ticket)
        workflow.add_node("update_metadata", self._update_metadata)
        workflow.add_node("store_in_vectordb", self._store_in_vectordb)
        
        # Define the edges
        workflow.add_edge("retrieve_ticket", "find_similar")
        workflow.add_edge("find_similar", "classify")
        workflow.add_edge("classify", "update_metadata")
        workflow.add_edge("update_metadata", "store_in_vectordb")
        workflow.add_edge("store_in_vectordb", END)
        
        # Set the entry point
        workflow.set_entry_point("retrieve_ticket")
        
        return workflow.compile()

    async def _retrieve_ticket(self, state: AgentState) -> AgentState:
        """Retrieve ticket information."""
        print(f"\nRetrieving ticket {state['ticket_id']}")
        retriever = self.tools[0]  # ticket_retriever tool
        ticket_data = await retriever.func(state["ticket_id"])
        
        print(f"Retrieved ticket data: {ticket_data}")
        state["ticket_data"] = ticket_data
        state["messages"].append(f"Retrieved ticket: {ticket_data.get('title', 'No title')}")
        state["next_step"] = "find_similar"
        
        return state

    async def _find_similar_tickets(self, state: AgentState) -> AgentState:
        """Find similar tickets."""
        print("\nFinding similar tickets")
        vector_search = self.tools[1]  # vector_search tool
        query_text = f"{state['ticket_data'].get('title', '')} {state['ticket_data'].get('description', '')}"
        similar_tickets = await vector_search.func(query_text)
        
        print(f"Found similar tickets: {similar_tickets}")
        state["similar_tickets"] = similar_tickets
        state["messages"].append(f"Found {len(similar_tickets)} similar tickets")
        state["next_step"] = "classify"
        
        return state

    async def _classify_ticket(self, state: AgentState) -> AgentState:
        """Classify if ticket can be auto-resolved."""
        print("\nClassifying ticket")
        classifier = self.tools[2]  # ticket_classifier tool
        classification = await classifier.func(state["ticket_data"])
        
        print(f"Classification result: {classification}")
        state["can_auto_resolve"] = classification["can_auto_resolve"]
        state["confidence"] = classification["confidence"]
        state["metadata_updates"] = classification["metadata_updates"]
        state["messages"].append(
            f"Classification complete: Can auto-resolve: {state['can_auto_resolve']}, "
            f"Confidence: {state['confidence']:.2f}"
        )
        state["next_step"] = "update_metadata"
        
        return state

    async def _update_metadata(self, state: AgentState) -> AgentState:
        """Update ticket metadata in Supabase."""
        try:
            print("\nUpdating ticket metadata")
            print(f"Current ticket ID: {state['ticket_id']}")
            
            # Use existing metadata from state
            current_metadata = state['ticket_data'].get('metadata', {})
            print(f"Current metadata from state: {current_metadata}")

            # Merge with new metadata updates
            print(f"\nNew metadata updates to apply: {state['metadata_updates']}")
            updated_metadata = {
                **current_metadata,
                **state["metadata_updates"]
            }
            print(f"Merged metadata to save: {updated_metadata}")

            # Update in Supabase
            print("\nAttempting to update metadata in Supabase...")
            update_query = self.supabase.client.from_("tickets").update({
                "metadata": updated_metadata
            }).eq("id", state["ticket_id"])
            print(f"Update query prepared: {update_query}")
            
            update_response = update_query.execute()
            print(f"Update response: {update_response}")

            state["messages"].append("Updated ticket metadata")
            return state
        except Exception as e:
            error_msg = f"Error updating metadata: {str(e)}"
            print(f"\nException details: {type(e).__name__}")
            print(f"Exception args: {e.args}")
            print(error_msg)
            state["messages"].append(error_msg)
            return state

    async def _store_in_vectordb(self, state: AgentState) -> AgentState:
        """Store the ticket in the vector database."""
        try:
            print("\nStoring ticket in vector database")
            
            # Prepare content from ticket data
            content = f"Title: {state['ticket_data'].get('title', '')}\n"
            content += f"Description: {state['ticket_data'].get('description', '')}"
            
            # Prepare metadata
            metadata = {
                "ticket_id": state["ticket_id"],
                "creator_id": state["ticket_data"].get("creator_id"),
                "status": state["ticket_data"].get("status"),
                "priority": state["ticket_data"].get("priority"),
                "stored_at": datetime.utcnow().isoformat()
            }
            
            # Store in vector database
            await self.vector_store.store_document(
                document_id=state["ticket_id"],
                content=content,
                metadata=metadata
            )
            
            state["messages"].append("Stored ticket in vector database")
            return state
            
        except Exception as e:
            error_msg = f"Error storing in vector database: {str(e)}"
            print(error_msg)
            state["messages"].append(error_msg)
            return state

    async def process_ticket(self, ticket_id: str) -> Dict[str, Any]:
        """Process a ticket through the workflow."""
        try:
            print(f"\nStarting to process ticket {ticket_id}")
            # Initialize the state
            initial_state = AgentState(
                ticket_id=ticket_id,
                ticket_data={},
                similar_tickets=[],
                can_auto_resolve=False,
                confidence=0.0,
                messages=[],
                next_step="retrieve_ticket",
                metadata_updates={}
            )
            
            # Run the workflow
            final_state = await self.workflow.ainvoke(initial_state)
            print(f"Final state: {final_state}")
            
            return {
                "ticket_id": ticket_id,
                "can_auto_resolve": final_state["can_auto_resolve"],
                "confidence": final_state["confidence"],
                "similar_tickets": final_state["similar_tickets"],
                "processing_log": final_state["messages"],
                "status": "success"
            }
        except Exception as e:
            error_msg = f"Error processing ticket: {str(e)}"
            print(error_msg)
            return {
                "ticket_id": ticket_id,
                "error": str(e),
                "status": "error"
            } 