from typing import Annotated, Dict, List, Tuple, TypedDict
from langgraph.graph import Graph, StateGraph
from langchain_core.messages import BaseMessage, HumanMessage
from agents.auto_resolution_agent import AutoResolutionAgent, ResolutionStep, ResolutionResult
from agents.classifier_agent import ClassifierAgent
from agents.retrieval_agent import RetrievalAgent

class AutoResolutionState(TypedDict):
    """State for the auto-resolution flow."""
    ticket: Dict  # The ticket being processed with fields:
                 # id: UUID string
                 # title: str
                 # description: str
                 # status: str
                 # priority: str
                 # creator_id: UUID string
                 # category: str (from metadata.Issue_Category)
                 # created_at: datetime string
    similar_tickets: List[Dict]  # Similar tickets found
    classification: Dict  # Classification results
    current_step: int  # Current step in resolution
    steps: List[ResolutionStep]  # Steps to take
    messages: List[BaseMessage]  # Conversation history
    results: List[Dict]  # Results from each step
    final_resolution: ResolutionResult  # Final resolution result

def create_auto_resolution_flow(
    auto_resolution_agent: AutoResolutionAgent,
    classifier_agent: ClassifierAgent,
    retrieval_agent: RetrievalAgent
) -> Graph:
    """Create the auto-resolution flow graph."""
    
    # Node functions
    async def find_similar_tickets(state: AutoResolutionState) -> AutoResolutionState:
        """Find similar tickets using retrieval agent."""
        ticket_data = {
            "title": state["ticket"]["title"],
            "description": state["ticket"]["description"],
            "metadata": {
                "Issue_Category": state["ticket"]["category"],
                "priority": state["ticket"]["priority"]
            }
        }
        similar_tickets = await retrieval_agent.find_similar_tickets(ticket_data)
        state["similar_tickets"] = [t.model_dump() for t in similar_tickets]
        return state

    async def classify_ticket(state: AutoResolutionState) -> Tuple[str, AutoResolutionState]:
        """Classify ticket using classifier agent."""
        ticket_data = {
            "id": state["ticket"]["id"],
            "title": state["ticket"]["title"],
            "description": state["ticket"]["description"],
            "metadata": {
                "Issue_Category": state["ticket"]["category"],
                "priority": state["ticket"]["priority"]
            },
            "status": state["ticket"]["status"],
            "creator_id": state["ticket"]["creator_id"]
        }
        classification = await classifier_agent.classify_ticket(ticket_data, state["similar_tickets"])
        state["classification"] = classification.model_dump()
        
        # Only proceed to resolution if ticket can be auto-resolved
        return ("resolve" if classification.can_auto_resolve else "end", state)

    async def plan_resolution(state: AutoResolutionState) -> AutoResolutionState:
        """Plan resolution steps using auto-resolution agent."""
        ticket = state["ticket"]
        analysis = await auto_resolution_agent.analyze_resolution_steps(
            title=ticket["title"],
            description=ticket["description"],
            category=ticket.get("category", "general"),
            similar_tickets=state["similar_tickets"]
        )
        state["steps"] = analysis.get("steps", [])
        state["current_step"] = 0
        return state

    async def execute_step(state: AutoResolutionState) -> Tuple[str, AutoResolutionState]:
        """Execute the current resolution step."""
        if state["current_step"] >= len(state["steps"]):
            return "end", state
            
        step = state["steps"][state["current_step"]]
        if step.tool_name and step.tool_name in auto_resolution_agent.tool_map:
            tool = auto_resolution_agent.tool_map[step.tool_name]
            result = await tool.ainvoke(step.tool_args or {})
            state["results"].append({
                "step": step.dict(),
                "result": result
            })
            
        state["current_step"] += 1
        return "continue" if state["current_step"] < len(state["steps"]) else "end", state

    async def finalize_resolution(state: AutoResolutionState) -> AutoResolutionState:
        """Create final resolution result."""
        results = state["results"]
        classification = state["classification"]
        
        # Check if all steps were successful
        success = all(
            not isinstance(r["result"], dict) or not r["result"].get("error")
            for r in results
        )
        
        state["final_resolution"] = ResolutionResult(
            success=success and classification.get("can_auto_resolve", False),
            steps_taken=state["steps"],
            solution=classification.get("auto_resolution_steps", []),
            failure_reason=None if success else "One or more resolution steps failed"
        )
        return state

    # Create the graph
    workflow = StateGraph(AutoResolutionState)
    
    # Add nodes
    workflow.add_node("retrieve", find_similar_tickets)
    workflow.add_node("classify", classify_ticket)
    workflow.add_node("plan", plan_resolution)
    workflow.add_node("execute", execute_step)
    workflow.add_node("finalize", finalize_resolution)
    
    # Add edges
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "classify")
    workflow.add_conditional_edges(
        "classify",
        lambda x: x[0],
        {
            "resolve": "plan",
            "end": "finalize"
        }
    )
    workflow.add_edge("plan", "execute")
    workflow.add_conditional_edges(
        "execute",
        lambda x: x[0],
        {
            "continue": "execute",
            "end": "finalize"
        }
    )
    
    return workflow.compile()

def initialize_state(ticket: Dict) -> AutoResolutionState:
    """Initialize the state for a new ticket."""
    return {
        "ticket": ticket,
        "similar_tickets": [],
        "classification": {},
        "current_step": 0,
        "steps": [],
        "messages": [],
        "results": [],
        "final_resolution": None
    } 