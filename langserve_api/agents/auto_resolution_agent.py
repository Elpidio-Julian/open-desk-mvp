from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain.tools import Tool, StructuredTool, tool
from langchain_core.tools import BaseTool
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser
import json
import logging
import httpx
from datetime import datetime
import os
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)

class ResolutionStep(BaseModel):
    """A single step in the resolution process."""
    action: str = Field(description="The action to take")
    reason: str = Field(description="Why this action is needed")
    tool_name: Optional[str] = Field(description="Name of the tool to use, if any")
    tool_args: Optional[Dict[str, Any]] = Field(description="Arguments for the tool")

class ResolutionResult(BaseModel):
    """Result of an auto-resolution attempt."""
    success: bool = Field(description="Whether the resolution was successful")
    steps_taken: List[ResolutionStep] = Field(description="Steps taken during resolution")
    solution: Optional[str] = Field(description="The final solution if successful")
    failure_reason: Optional[str] = Field(description="Reason for failure if unsuccessful")

class AutoResolutionAgent:
    """Agent responsible for automatically resolving tickets using available tools."""
    
    def __init__(self, vector_store: VectorStore):
        self.llm = ChatOpenAI(temperature=0)
        self.vector_store = vector_store
        self.resolved_vector_store = VectorStore(collection_name="resolved_tickets")
        self.tools = self._setup_tools()
        self.tool_map = {tool.name: tool for tool in self.tools}
        
        # Initialize HTTP client for external services
        self.http_client = httpx.AsyncClient(timeout=30.0)  # 30 second timeout
        
        # Setup prompts
        self.analyze_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert support agent that analyzes tickets and plans resolution steps.
            Given a ticket and similar resolved tickets, determine if and how this ticket can be resolved.
            Consider:
            1. Available tools and their capabilities
            2. Similar tickets and their resolutions
            3. Required steps for resolution
            4. Potential risks or complications
            
            Output a JSON with the following structure:
            {
                "can_resolve": bool,  # Whether we can resolve this ticket
                "confidence": float,  # Confidence in resolution (0-1)
                "steps": [  # List of steps needed
                    {
                        "action": str,  # What to do
                        "reason": str,  # Why this step is needed
                        "tool_name": str | null,  # Tool to use (if any)
                        "tool_args": dict | null  # Arguments for the tool
                    }
                ],
                "explanation": str  # Overall explanation of the approach
            }"""),
            ("human", """Please analyze this ticket:
            Title: {title}
            Description: {description}
            Category: {category}
            
            Similar resolved tickets:
            {similar_tickets}
            
            Available tools:
            {tool_descriptions}""")
        ])
    
    def _setup_tools(self) -> List[BaseTool]:
        """Setup tools available to the agent."""
        
        @tool
        async def search_knowledge_base(query: str) -> str:
            """Search the knowledge base for relevant articles or solutions."""
            try:
                # Search resolved tickets collection for relevant articles
                similar_docs = await self.resolved_vector_store.find_similar_tickets(
                    query_text=query,
                    n_results=3,
                    score_threshold=0.7
                )
                
                if not similar_docs:
                    return "No relevant articles found."
                
                # Format the results
                results = []
                for doc in similar_docs:
                    metadata = doc['metadata']
                    results.append(
                        f"Article: {metadata.get('title', 'Untitled')}\n"
                        f"Solution: {metadata.get('solution', 'No solution recorded')}\n"
                        f"Auto-resolved: {metadata.get('auto_resolved', False)}\n"
                        f"Success Rate: {metadata.get('success_rate', 0)}\n"
                    )
                
                return "\n".join(results) if results else "No resolved tickets found."
                
            except Exception as e:
                logger.error(f"Error searching knowledge base: {str(e)}")
                return "Error searching knowledge base"
        
        @tool
        async def check_user_permissions(user_id: str) -> Dict[str, Any]:
            """Check what permissions a user has in Supabase."""
            try:
                # Query Supabase for user permissions
                url = f"{os.getenv('VITE_PROD_SUPABASE_URL')}/rest/v1/users"
                headers = {
                    "apikey": os.getenv("VITE_PROD_SUPABASE_ANON_KEY"),
                    "Authorization": f"Bearer {os.getenv('VITE_PROD_SUPABASE_ANON_KEY')}"
                }
                params = {"id": f"eq.{user_id}", "select": "id,role,permissions"}
                
                async with self.http_client as client:
                    response = await client.get(url, headers=headers, params=params)
                    
                if response.status_code != 200:
                    return {
                        "error": "Failed to fetch user permissions",
                        "can_reset_password": False,
                        "admin": False
                    }
                
                user_data = response.json()[0] if response.json() else {}
                return {
                    "can_reset_password": True,  # Most users can reset their own password
                    "admin": user_data.get("role") == "admin",
                    "permissions": user_data.get("permissions", [])
                }
                
            except Exception as e:
                logger.error(f"Error checking user permissions: {str(e)}")
                return {
                    "error": str(e),
                    "can_reset_password": False,
                    "admin": False
                }
        
        @tool
        async def reset_user_password(user_id: str) -> str:
            """Reset a user's password and send them reset instructions."""
            try:
                # Generate password reset link via Supabase
                url = f"{os.getenv('VITE_PROD_SUPABASE_URL')}/auth/v1/recover"
                headers = {
                    "apikey": os.getenv("VITE_PROD_SUPABASE_ANON_KEY"),
                    "Content-Type": "application/json"
                }
                
                async with self.http_client as client:
                    response = await client.post(
                        url,
                        headers=headers,
                        json={"user_id": user_id}
                    )
                    
                if response.status_code == 200:
                    return "Password reset email sent successfully"
                else:
                    return f"Failed to send password reset email: {response.text}"
                
            except Exception as e:
                logger.error(f"Error resetting password: {str(e)}")
                return f"Error resetting password: {str(e)}"
        
        @tool
        async def verify_system_status(service: str) -> Dict[str, Any]:
            """Check if a specific service or system is operational."""
            try:
                service_endpoints = {
                    "auth": f"{os.getenv('VITE_PROD_SUPABASE_URL')}/auth/v1/health",
                    "database": f"{os.getenv('VITE_PROD_SUPABASE_URL')}/rest/v1/health",
                    "storage": f"{os.getenv('VITE_PROD_SUPABASE_URL')}/storage/v1/health"
                }
                
                if service not in service_endpoints:
                    return {
                        "operational": False,
                        "error": f"Unknown service: {service}"
                    }
                
                start_time = datetime.now()
                async with self.http_client as client:
                    response = await client.get(
                        service_endpoints[service],
                        headers={"apikey": os.getenv("VITE_PROD_SUPABASE_ANON_KEY")}
                    )
                
                latency = (datetime.now() - start_time).total_seconds() * 1000
                
                return {
                    "operational": response.status_code == 200,
                    "latency": f"{latency:.0f}ms",
                    "status_code": response.status_code,
                    "details": response.text if response.status_code != 200 else None
                }
                
            except Exception as e:
                logger.error(f"Error checking system status: {str(e)}")
                return {
                    "operational": False,
                    "error": str(e)
                }
        
        return [
            search_knowledge_base,
            check_user_permissions,
            reset_user_password,
            verify_system_status
        ]
    
    def _format_tool_descriptions(self) -> str:
        """Format tool descriptions for the prompt."""
        descriptions = []
        for tool in self.tools:
            descriptions.append(f"- {tool.name}: {tool.description}")
        return "\n".join(descriptions)
    
    def _format_similar_tickets(self, similar_tickets: List[Dict[str, Any]]) -> str:
        """Format similar tickets for the prompt."""
        if not similar_tickets:
            return "No similar tickets found."
        
        formatted = []
        for i, ticket in enumerate(similar_tickets, 1):
            formatted.append(f"""
            Ticket {i}:
            Title: {ticket.get('title', 'N/A')}
            Resolution: {ticket.get('resolution', 'N/A')}
            Auto-resolved: {ticket.get('can_auto_resolve', False)}
            Success Rate: {ticket.get('success_rate', 0)}
            """)
        return "\n".join(formatted)
    
    async def analyze_resolution_steps(
        self,
        title: str,
        description: str,
        category: str,
        similar_tickets: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze a ticket and determine resolution steps."""
        try:
            # Format inputs
            tool_descriptions = self._format_tool_descriptions()
            similar_tickets_text = self._format_similar_tickets(similar_tickets)
            
            # Get analysis from LLM
            response = await self.llm.ainvoke(
                self.analyze_prompt.format_messages(
                    title=title,
                    description=description,
                    category=category,
                    similar_tickets=similar_tickets_text,
                    tool_descriptions=tool_descriptions
                )
            )
            
            # Parse response
            try:
                analysis = json.loads(response.content)
                return analysis
            except json.JSONDecodeError:
                logger.error("Failed to parse LLM response as JSON")
                return {
                    "can_resolve": False,
                    "confidence": 0,
                    "steps": [],
                    "explanation": "Failed to parse resolution steps"
                }
            
        except Exception as e:
            logger.error(f"Error analyzing resolution steps: {str(e)}")
            raise
    
    async def execute_resolution_step(self, step: ResolutionStep) -> Dict[str, Any]:
        """Execute a single resolution step."""
        try:
            if not step.tool_name:
                return {"success": True, "result": "No tool action needed"}
            
            tool = self.tool_map.get(step.tool_name)
            if not tool:
                return {
                    "success": False,
                    "error": f"Tool {step.tool_name} not found"
                }
            
            result = await tool.ainvoke(**(step.tool_args or {}))
            return {"success": True, "result": result}
            
        except Exception as e:
            logger.error(f"Error executing resolution step: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def resolve_ticket(
        self,
        title: str,
        description: str,
        category: str,
        similar_tickets: List[Dict[str, Any]]
    ) -> ResolutionResult:
        """
        Attempt to resolve a ticket automatically.
        Returns the resolution result with steps taken and outcome.
        """
        try:
            # Analyze resolution steps
            analysis = await self.analyze_resolution_steps(
                title=title,
                description=description,
                category=category,
                similar_tickets=similar_tickets
            )
            
            if not analysis["can_resolve"]:
                return ResolutionResult(
                    success=False,
                    steps_taken=[],
                    failure_reason="Ticket cannot be auto-resolved"
                )
            
            # Execute each step
            steps_taken = []
            for step_data in analysis["steps"]:
                step = ResolutionStep(**step_data)
                result = await self.execute_resolution_step(step)
                steps_taken.append(step)
                
                if not result["success"]:
                    return ResolutionResult(
                        success=False,
                        steps_taken=steps_taken,
                        failure_reason=f"Step failed: {result.get('error')}"
                    )
            
            return ResolutionResult(
                success=True,
                steps_taken=steps_taken,
                solution=analysis.get("explanation")
            )
            
        except Exception as e:
            logger.error(f"Error resolving ticket: {str(e)}")
            return ResolutionResult(
                success=False,
                steps_taken=[],
                failure_reason=str(e)
            ) 