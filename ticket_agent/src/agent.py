from langchain_core.tools import tool, BaseTool
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from typing import Dict, List, Annotated, Union, Optional, TypedDict
from pydantic import BaseModel, Field
from .utils.db import VectorStore
from langgraph.graph import StateGraph, END
import json
import operator
from typing import TypeVar, Annotated
import re

# Define state types
class AgentState(TypedDict):
    input: str
    classification: Optional[Dict]
    resolution: Optional[Dict]
    final_summary: Optional[str]
    next_steps: List[str]
    error: Optional[str]

class ClassifyTicketTool(BaseTool):
    name: str = "classify_ticket"
    description: str = "Classifies a ticket based on its content and determines routing"
    vector_store: VectorStore = None
    
    def __init__(self, vector_store: VectorStore):
        super().__init__()
        self.vector_store = vector_store
    
    def _analyze_category(self, content: str, similar_tickets: List) -> tuple[str, float]:
        """Analyze ticket content to determine category"""
        # Category keywords
        category_patterns = {
            "password_reset": ["password", "reset", "forgot", "can't log in", "login issues"],
            "system_outage": ["system down", "outage", "500 error", "not working", "broken"],
            "security": ["security", "unauthorized", "breach", "hack", "suspicious"],
            "performance": ["slow", "performance", "latency", "memory leak", "response time"],
            "feature_request": ["feature", "add", "new", "would it be possible", "suggestion"],
            "billing": ["bill", "invoice", "charge", "payment", "subscription"],
            "account": ["account", "team member", "permission", "access", "role"]
        }
        
        content_lower = content.lower()
        
        # Check for explicit category matches first
        best_category = None
        best_matches = 0
        
        for category, patterns in category_patterns.items():
            matches = sum(1 for pattern in patterns if pattern in content_lower)
            if matches > best_matches:
                best_matches = matches
                best_category = category
        
        # If we found a strong category match, use it
        if best_matches >= 1:
            return best_category, 0.8 + (0.1 * best_matches)  # Higher confidence with more matches
        
        # Fall back to similar tickets if no strong match
        if similar_tickets:
            category = similar_tickets[0][0].metadata.get('category', 'unknown')
            confidence = similar_tickets[0][1]
            return category, confidence
        
        return "unknown", 0.0

    def _analyze_urgency(self, content: str) -> str:
        """Analyze ticket urgency based on keywords and patterns"""
        urgent_keywords = ['urgent', 'emergency', 'critical', 'down', 'broken', 'immediately', 'asap']
        high_keywords = ['important', 'serious', 'error', 'failed', 'issue']
        
        content_lower = content.lower()
        
        # Check for explicit urgency indicators
        if "not urgent" in content_lower or "isn't urgent" in content_lower:
            return "normal"
        
        if any(word in content_lower for word in urgent_keywords):
            return "urgent"
        elif any(word in content_lower for word in high_keywords):
            return "high"
        return "normal"
    
    def _determine_team(self, category: str, urgency: str) -> str:
        """Determine which team should handle the ticket"""
        team_mapping = {
            "password_reset": "identity_team",
            "system_outage": "infrastructure_team",
            "performance": "platform_team",
            "security": "security_team",
            "billing": "billing_team",
            "feature_request": "product_team",
            "bug": "engineering_team",
            "account": "customer_success_team",
            "unknown": "triage_team"
        }
        
        # Override team based on urgency
        if urgency == "urgent":
            if category in ["system_outage", "performance"]:
                return "incident_response_team"
            elif category == "security":
                return "security_incident_team"
        
        return team_mapping.get(category, "general_support_team")

    def _estimate_complexity(self, content: str, similar_tickets: List) -> str:
        """Estimate ticket complexity based on content and similar tickets"""
        # Complexity indicators in content
        complex_indicators = [
            "multiple", "several", "complex", "complicated", "unclear",
            "inconsistent", "intermittent", "affecting all", "enterprise",
            "integration", "memory leak", "microservices"
        ]
        
        content_lower = content.lower()
        complexity_score = sum(1 for indicator in complex_indicators if indicator in content_lower)
        
        # Add complexity if the description is very detailed
        if len(content.split()) > 50:  # Long descriptions often indicate complexity
            complexity_score += 1
        
        # Check resolution time of similar tickets
        avg_resolution_time = 0
        resolution_times = [t[0].metadata.get('resolution_time', 0) for t in similar_tickets]
        if resolution_times:
            avg_resolution_time = sum(resolution_times) / len(resolution_times)
            if avg_resolution_time > 24:
                complexity_score += 2
            elif avg_resolution_time > 4:
                complexity_score += 1
        
        if complexity_score >= 3:
            return "complex"
        elif complexity_score >= 1:
            return "medium"
        return "simple"
    
    def _run(self, ticket_content: str | dict) -> Dict:
        # Handle both string and dict inputs
        if isinstance(ticket_content, dict):
            ticket_content = ticket_content.get("ticket_content", "")
        
        similar_tickets = self.vector_store.similar_tickets(ticket_content)
        
        # Get category and confidence
        category, confidence = self._analyze_category(ticket_content, similar_tickets)
        
        # Analyze additional factors
        urgency = self._analyze_urgency(ticket_content)
        complexity = self._estimate_complexity(ticket_content, similar_tickets)
        assigned_team = self._determine_team(category, urgency)
        
        # Determine if ticket can be auto-resolved
        auto_resolvable = (
            urgency == "normal" and
            complexity == "simple" and
            category in ["password_reset"] and  # Only auto-resolve specific categories
            similar_tickets and
            sum(1 for t in similar_tickets if t[0].metadata.get('auto_resolved', False)) / len(similar_tickets) > 0.7
        )
        
        # Set priority based on urgency, complexity, and category
        priority_matrix = {
            # Urgent tickets
            ("urgent", "complex", True): "critical",   # True for high-impact categories
            ("urgent", "complex", False): "high",
            ("urgent", "medium", True): "critical",
            ("urgent", "medium", False): "high",
            ("urgent", "simple", True): "high",
            ("urgent", "simple", False): "high",
            # High urgency tickets
            ("high", "complex", True): "high",
            ("high", "complex", False): "high",
            ("high", "medium", True): "high",
            ("high", "medium", False): "medium",
            ("high", "simple", True): "medium",
            ("high", "simple", False): "medium",
            # Normal urgency tickets
            ("normal", "complex", True): "medium",
            ("normal", "complex", False): "medium",
            ("normal", "medium", True): "medium",
            ("normal", "medium", False): "low",
            ("normal", "simple", True): "low",
            ("normal", "simple", False): "low"
        }
        
        # High-impact categories that affect priority
        high_impact = category in ["system_outage", "security", "performance"]
        priority = priority_matrix.get((urgency, complexity, high_impact), "medium")
        
        return {
            "can_autoresolve": auto_resolvable,
            "category": category,
            "priority": priority,
            "confidence": confidence,
            "urgency": urgency,
            "complexity": complexity,
            "assigned_team": assigned_team,
            "similar_tickets_count": len(similar_tickets)
        }

class ResolveTicketTool(BaseTool):
    name: str = "resolve_ticket"
    description: str = "Attempts to automatically resolve a ticket or route it to the appropriate team"
    
    def _get_team_specific_steps(self, team: str, category: str) -> List[str]:
        """Get team-specific next steps based on the assigned team"""
        team_steps = {
            "incident_response_team": [
                "Initiate incident response protocol",
                "Set up emergency response bridge",
                "Begin impact assessment",
                "Prepare customer communication"
            ],
            "security_incident_team": [
                "Initiate security incident protocol",
                "Isolate affected systems",
                "Begin forensic analysis",
                "Prepare incident report"
            ],
            "infrastructure_team": [
                "Check system health metrics",
                "Review recent deployments",
                "Analyze system logs",
                "Prepare mitigation plan"
            ],
            "platform_team": [
                "Review performance metrics",
                "Check system bottlenecks",
                "Analyze resource usage",
                "Plan optimization steps"
            ],
            "identity_team": [
                "Verify user identity",
                "Check access logs",
                "Review recent changes",
                "Update security protocols if needed"
            ],
            "engineering_team": [
                "Reproduce the issue",
                "Review error logs",
                "Check related code changes",
                "Plan bug fix implementation"
            ],
            "product_team": [
                "Evaluate feature request",
                "Check product roadmap",
                "Gather user requirements",
                "Plan implementation timeline"
            ],
            "billing_team": [
                "Review billing history",
                "Check payment systems",
                "Verify account status",
                "Update billing records"
            ],
            "customer_success_team": [
                "Review account history",
                "Check recent interactions",
                "Identify improvement areas",
                "Plan follow-up actions"
            ]
        }
        
        return team_steps.get(team, [
            "Review ticket details",
            "Check similar past tickets",
            "Plan appropriate response",
            "Update ticket status"
        ])
    
    def _run(self, args: str | dict) -> Dict:
        # Handle both string and dict inputs
        if isinstance(args, dict):
            ticket_content = args.get("ticket_content", "")
            classification = args.get("classification", {})
        else:
            ticket_content = args
            classification = {}
        
        # Extract classification details
        can_autoresolve = classification.get('can_autoresolve', False)
        category = classification.get('category', 'unknown')
        priority = classification.get('priority', 'medium')
        urgency = classification.get('urgency', 'normal')
        complexity = classification.get('complexity', 'medium')
        assigned_team = classification.get('assigned_team', 'general_support_team')
        
        # Get team-specific next steps
        next_steps = self._get_team_specific_steps(assigned_team, category)
        
        if can_autoresolve:
            return {
                "resolved": True,
                "resolution_message": f"Auto-resolved {category} ticket based on historical data",
                "assigned_to": "auto_resolved",
                "priority": priority,
                "team": assigned_team,
                "next_steps": ["Monitor for similar issues", "Update resolution templates if needed"]
            }
        
        # For high urgency tickets, add SLA information
        sla_times = {
            "critical": "1 hour",
            "high": "4 hours",
            "medium": "24 hours",
            "low": "48 hours"
        }
        
        resolution_message = (
            f"Assigned to {assigned_team} with {priority} priority. "
            f"Target response time: {sla_times.get(priority, '24 hours')}. "
            f"Complexity: {complexity}"
        )
        
        return {
            "resolved": False,
            "resolution_message": resolution_message,
            "assigned_to": assigned_team,
            "priority": priority,
            "team": assigned_team,
            "next_steps": next_steps,
            "sla": sla_times.get(priority, "24 hours")
        }

class CustomOutputParser:
    def parse(self, text: str) -> Union[Dict, str]:
        # If there's a Final Answer, extract it
        if "Final Answer:" in text:
            final_answer = text[text.index("Final Answer:"):].split("\n", 1)[1].strip()
            return {"output": final_answer}
        
        # Otherwise, look for Action and Action Input
        action_match = re.search(r"Action: (.*?)(?:\n|$)", text)
        input_match = re.search(r"Action Input: (.*?)(?:\n|$)", text)
        
        if action_match and input_match:
            return {
                "action": action_match.group(1).strip(),
                "action_input": input_match.group(1).strip()
            }
        
        return {"output": text.strip()}

class TicketRoutingAgent:
    def __init__(self):
        # Initialize the LLM
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.2
        )
        
        # Initialize vector store
        self.vector_store = VectorStore()
        
        # Initialize tools
        self.classify_tool = ClassifyTicketTool(self.vector_store)
        self.resolve_tool = ResolveTicketTool()
        
        # Create the workflow graph
        self.workflow = self._create_workflow()

    def _classify_ticket(self, state: AgentState) -> AgentState:
        """Classify the ticket using the classification tool"""
        try:
            result = self.classify_tool._run(state["input"])
            state["classification"] = result
            return state
        except Exception as e:
            state["error"] = f"Classification failed: {str(e)}"
            return state

    def _resolve_ticket(self, state: AgentState) -> AgentState:
        """Attempt to resolve the ticket using the resolution tool"""
        try:
            if not state.get("classification"):
                state["error"] = "Cannot resolve ticket without classification"
                return state
            
            result = self.resolve_tool._run({
                "ticket_content": state["input"],
                "classification": state["classification"]
            })
            state["resolution"] = result
            return state
        except Exception as e:
            state["error"] = f"Resolution failed: {str(e)}"
            return state

    def _create_summary(self, state: AgentState) -> AgentState:
        """Create the final summary based on classification and resolution"""
        try:
            if not state.get("classification") or not state.get("resolution"):
                state["error"] = "Cannot create summary without classification and resolution"
                return state
            
            classification = state["classification"]
            resolution = state["resolution"]
            
            summary = f"""Here's what happened:
- Classification: {classification['category']} ticket
  - Priority: {classification['priority']}
  - Urgency: {classification['urgency']}
  - Complexity: {classification['complexity']}
  - Confidence: {classification.get('confidence', 'N/A')}
  - Similar tickets found: {classification.get('similar_tickets_count', 0)}

- Resolution: {"Auto-resolved" if resolution.get('resolved', False) else "Needs human attention"}
  - Assigned to: {resolution['team']}
  - Target response time: {resolution.get('sla', 'N/A')}
  - Status: {resolution['resolution_message']}

- Next Steps:
"""
            next_steps = resolution.get('next_steps', [])
            for i, step in enumerate(next_steps, 1):
                summary += f"  {i}. {step}\n"
            
            state["final_summary"] = summary.strip()
            state["next_steps"] = next_steps
            return state
        except Exception as e:
            state["error"] = f"Summary creation failed: {str(e)}"
            return state

    def _should_end(self, state: AgentState) -> bool:
        """Determine if the workflow should end"""
        return bool(state.get("error") or state.get("final_summary"))

    def _create_workflow(self) -> StateGraph:
        """Create the workflow graph for ticket processing"""
        # Create the graph
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("classify", self._classify_ticket)
        workflow.add_node("resolve", self._resolve_ticket)
        workflow.add_node("summarize", self._create_summary)
        
        # Add edges
        workflow.add_edge("classify", "resolve")
        workflow.add_edge("resolve", "summarize")
        
        # Set conditional edges
        workflow.add_conditional_edges(
            "summarize",
            self._should_end,
            {
                True: END,
                False: "classify"  # Retry from start if something went wrong
            }
        )
        
        # Set entry point
        workflow.set_entry_point("classify")
        
        return workflow.compile()

    def process_ticket(self, ticket_content: str) -> Dict:
        """
        Main method to process a ticket through the workflow
        """
        # Initialize state
        state = AgentState(
            input=ticket_content,
            classification=None,
            resolution=None,
            final_summary=None,
            next_steps=[],
            error=None
        )
        
        # Run the workflow
        final_state = self.workflow.invoke(state)
        
        # Check for errors
        if final_state.get("error"):
            return {
                "input": ticket_content,
                "output": f"Error processing ticket: {final_state['error']}"
            }
        
        return {
            "input": ticket_content,
            "output": final_state.get("final_summary", "No summary generated")
        } 