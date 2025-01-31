from typing import Dict, Any, TypedDict, List, Annotated
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from services.ticket_tools import get_ticket_tools
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage

class AgentState(TypedDict):
    """State for the ticket processing agent."""
    ticket_id: str
    ticket_data: Dict[str, Any]
    similar_tickets: List[Dict[str, Any]]
    can_auto_resolve: bool
    confidence: float
    messages: List[str]
    next_step: str

class TicketAgent:
    """Agent for processing and classifying support tickets using a graph-based approach."""

    def __init__(self):
        self.tools = get_ticket_tools()
        self.llm = ChatOpenAI(temperature=0)
        
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
        
        # Define the edges
        workflow.add_edge("retrieve_ticket", "find_similar")
        workflow.add_edge("find_similar", "classify")
        workflow.add_edge("classify", END)
        
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
        state["can_auto_resolve"] = classification.get("can_auto_resolve", False)
        state["confidence"] = classification.get("confidence", 0.0)
        state["messages"].append(
            f"Classification complete: Can auto-resolve: {state['can_auto_resolve']}, "
            f"Confidence: {state['confidence']:.2f}"
        )
        
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
                next_step="retrieve_ticket"
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
            print(f"Error processing ticket: {str(e)}")
            return {
                "ticket_id": ticket_id,
                "error": str(e),
                "status": "error"
            } 