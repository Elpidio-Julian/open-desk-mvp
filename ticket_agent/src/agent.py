from langchain_core.tools import tool, BaseTool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from typing import Dict, List, Annotated
from pydantic import BaseModel, Field
from .utils.db import VectorStore

class ClassifyTicketTool(BaseTool):
    name: str = "classify_ticket"
    description: str = "Classifies a ticket based on its content"
    vector_store: VectorStore = None
    
    def __init__(self, vector_store: VectorStore):
        super().__init__()
        self.vector_store = vector_store
    
    def _run(self, ticket_content: str | dict) -> Dict:
        # Handle both string and dict inputs
        if isinstance(ticket_content, dict):
            ticket_content = ticket_content.get("ticket_content", "")
        
        similar_tickets = self.vector_store.similar_tickets(ticket_content)
        
        if not similar_tickets:
            return {
                "can_autoresolve": False,
                "category": "unknown",
                "priority": "medium"
            }
        
        similar_count = len(similar_tickets)
        auto_resolvable_count = sum(1 for ticket in similar_tickets if ticket[0].metadata.get('can_autoresolve', False))
        can_autoresolve = (auto_resolvable_count / similar_count) > 0.5
        category = similar_tickets[0][0].metadata.get('category', 'unknown')
        priority = "low" if can_autoresolve else "medium"
        
        return {
            "can_autoresolve": can_autoresolve,
            "category": category,
            "priority": priority,
            "confidence": similar_tickets[0][1]
        }

class ResolveTicketTool(BaseTool):
    name: str = "resolve_ticket"
    description: str = "Attempts to automatically resolve a ticket"
    
    def _run(self, args: str | dict) -> Dict:
        # Handle both string and dict inputs
        if isinstance(args, dict):
            ticket_content = args.get("ticket_content", "")
            classification = args.get("classification", {})
        else:
            ticket_content = args
            classification = {}
        
        if not classification.get('can_autoresolve', False):
            return {
                "resolved": False,
                "resolution_message": "This ticket requires human attention",
                "assigned_to": "support_team",
                "next_steps": [
                    "Review ticket category and priority",
                    "Check similar past tickets",
                    "Contact customer for more details if needed"
                ]
            }
        
        category = classification.get('category', 'unknown')
        
        if category == 'password_reset':
            return {
                "resolved": True,
                "resolution_message": "Password has been reset. New temporary password sent to user's email.",
                "assigned_to": "auto_resolved",
                "next_steps": ["User should change temporary password on next login"]
            }
        
        return {
            "resolved": True,
            "resolution_message": f"Auto-resolved based on similar past tickets in category: {category}",
            "assigned_to": "auto_resolved",
            "next_steps": ["Monitor for similar issues", "Update resolution templates if needed"]
        }

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
        self.tools = [
            ClassifyTicketTool(self.vector_store),
            ResolveTicketTool()
        ]
        
        # Create prompt template
        self.prompt = PromptTemplate.from_template(
            """You are a helpful support ticket routing assistant. Your job is to:
1. Understand the ticket content
2. Use the available tools to classify and resolve tickets
3. Provide clear next steps

Available tools:
{tools}

Tool Names: {tool_names}

Current ticket: {input}

Follow these steps EXACTLY:

1. First classify the ticket:
Thought: I need to analyze this ticket first
Action: classify_ticket
Action Input: {{"ticket_content": "the ticket content here"}}

2. Then resolve the ticket using the EXACT classification result:
Thought: Now I'll try to resolve the ticket using the exact classification result
Action: resolve_ticket
Action Input: {{"ticket_content": "the ticket content here", "classification": <paste the ENTIRE classification result dictionary here>}}

3. Finally, summarize everything in this format:
Thought: I will now summarize what happened
Final Answer: Here's what happened:
- Classification: <category> ticket with <priority> priority (confidence: <confidence>)
- Resolution: <"Auto-resolved" or "Needs human attention">
- Next Steps:
  1. <first step>
  2. <second step>
  3. <etc...>

Remember:
1. The classification result will contain: can_autoresolve, category, priority, and confidence
2. Use the EXACT classification result when calling resolve_ticket - do not modify it
3. Follow the output format EXACTLY as shown above
4. Do not add any extra actions after providing the Final Answer

{agent_scratchpad}
"""
        )
        
        # Create the agent
        self.agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=self.prompt
        )
        
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=3,  # Limit iterations to prevent infinite loops
            early_stopping_method="force"  # Force stop after max iterations
        )

    def process_ticket(self, ticket_content: str) -> Dict:
        """
        Main method to process a ticket through the agent.
        """
        # Let the agent handle the entire flow using the tools
        response = self.agent_executor.invoke({"input": ticket_content})
        return response 