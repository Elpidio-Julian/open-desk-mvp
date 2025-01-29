from typing import Dict, Any, Optional, List, TypedDict, Annotated
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain.output_parsers import PydanticOutputParser
from langchain_openai import OpenAIEmbeddings
from uuid import UUID
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing import TypeVar, Sequence
from .tools.priority_tool import PriorityAssessmentTool
from .tools.category_tool import CategoryClassificationTool
from .tools.tag_tool import TagExtractionTool
from .tools.metadata_tool import MetadataEnrichmentTool
from .models import TicketData, TicketMetadata

class AgentState(TypedDict):
    """State for the ticket processing workflow."""
    ticket: Dict[str, Any]  # Raw ticket data
    metadata: Dict[str, Any]  # Existing metadata
    context: Dict[str, Any]  # Additional context
    processed_ticket: Optional[TicketData]  # Processed ticket data
    error: Optional[str]  # Error message if any
    status: str  # Current status of processing

class IngestionAgent:
    """Agent responsible for structuring incoming ticket data and preparing for vector storage."""
    
    def __init__(self):
        self.llm = ChatOpenAI(temperature=0)
        self.output_parser = PydanticOutputParser(pydantic_object=TicketData)
        self.embeddings = OpenAIEmbeddings()
        
        # Initialize tools
        self.priority_tool = PriorityAssessmentTool()
        self.category_tool = CategoryClassificationTool()
        self.tag_tool = TagExtractionTool()
        self.metadata_tool = MetadataEnrichmentTool()
        
        # Create tool node
        self.tools = ToolNode(tools=[
            self.priority_tool,
            self.category_tool,
            self.tag_tool,
            self.metadata_tool
        ])
        
        self.workflow = self._create_workflow()

    async def _process_ticket_node(self, state: AgentState) -> AgentState:
        """Process the ticket and update state."""
        try:
            title = state["ticket"]["title"]
            description = state["ticket"]["description"]
            
            # Use tools to analyze ticket
            try:
                priority_result = await self.priority_tool.arun(title=title, description=description)
                category_result = await self.category_tool.arun(title=title, description=description)
                tag_result = await self.tag_tool.arun(title=title, description=description)
            except Exception as tool_error:
                print(f"Tool execution failed: {str(tool_error)}")
                raise ValueError(f"Tool execution failed: {str(tool_error)}")
            
            # Validate tool results
            if not priority_result or not priority_result.get("priority") in ["high", "medium", "low"]:
                raise ValueError(f"Invalid priority: {priority_result.get('priority') if priority_result else None}")
            if not category_result or not category_result.get("category"):
                raise ValueError("Missing category in tool result")
            if not tag_result or not tag_result.get("tags"):
                raise ValueError("Missing tags in tool result")
            
            # Create initial metadata
            new_metadata = TicketMetadata(
                Issue_Category=category_result["category"],
                ticket_tags=tag_result["tags"],
                technical_terms=tag_result.get("technical_terms", []),
                key_entities=tag_result.get("key_entities", []),
                browser=tag_result.get("browser"),
                platform=tag_result.get("platform")
            )
            
            # Create processed ticket
            ticket_data = TicketData(
                title=title,
                description=description,
                priority=priority_result["priority"],
                status="processed",
                metadata=new_metadata
            )
            
            # Set creator_id if available in context
            if state["context"].get("creator_id"):
                try:
                    ticket_data.creator_id = UUID(state["context"]["creator_id"])
                except ValueError as e:
                    print(f"Warning: Invalid creator_id format: {e}")
            
            # Update state
            state["processed_ticket"] = ticket_data
            state["status"] = "processed"
            return state
            
        except Exception as e:
            print(f"Error in process_ticket_node: {str(e)}")
            state["error"] = str(e)
            state["status"] = "error"
            return state

    async def _merge_metadata_node(self, state: AgentState) -> AgentState:
        """Merge existing metadata with processed metadata."""
        if state["status"] == "error" or not state["processed_ticket"]:
            return state
            
        try:
            if state["metadata"]:
                # Use metadata enrichment tool
                merged_result = await self.metadata_tool.arun(
                    existing_metadata=state["metadata"],
                    new_metadata=state["processed_ticket"].metadata.model_dump()
                )
                
                if not merged_result or "metadata" not in merged_result:
                    raise ValueError("Invalid metadata merge result")
                
                # Update ticket metadata with merged result
                state["processed_ticket"].metadata = TicketMetadata(**merged_result["metadata"])
            
            # Add context information if available
            if state["context"].get("creator_id"):
                try:
                    state["processed_ticket"].creator_id = UUID(state["context"]["creator_id"])
                except ValueError as e:
                    print(f"Warning: Invalid creator_id format: {e}")
                
            state["status"] = "completed"
            return state
            
        except Exception as e:
            print(f"Error in merge_metadata_node: {str(e)}")
            state["error"] = str(e)
            state["status"] = "error"
            return state

    async def _handle_error_node(self, state: AgentState) -> AgentState:
        """Handle errors by creating a fallback ticket."""
        if state["status"] != "error":
            return state
            
        # Create fallback ticket
        fallback_ticket = TicketData(
            title=state["ticket"]["title"],
            description=state["ticket"]["description"],
            status="new",
            priority="medium",
            metadata=TicketMetadata(**state["metadata"]) if state["metadata"] else TicketMetadata()
        )
        
        state["processed_ticket"] = fallback_ticket
        state["status"] = "completed"
        return state

    def _should_handle_error(self, state: AgentState) -> bool:
        """Determine if error handling is needed."""
        return state["status"] == "error"

    def _create_workflow(self) -> StateGraph:
        """Create the workflow graph."""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("process_ticket", self._process_ticket_node)
        workflow.add_node("merge_metadata", self._merge_metadata_node)
        workflow.add_node("handle_error", self._handle_error_node)
        
        # Add edges
        workflow.add_edge("process_ticket", "merge_metadata")
        workflow.add_conditional_edges(
            "merge_metadata",
            self._should_handle_error,
            {
                True: "handle_error",
                False: END
            }
        )
        workflow.add_edge("handle_error", END)
        
        # Set entry point
        workflow.set_entry_point("process_ticket")
        
        return workflow.compile()

    async def process_ticket(
        self,
        title: str,
        description: str,
        existing_metadata: Dict[str, Any] = None,
        context: Dict[str, Any] = None
    ) -> TicketData:
        """Process incoming ticket using the workflow."""
        initial_state: AgentState = {
            "ticket": {"title": title, "description": description},
            "metadata": existing_metadata or {},
            "context": context or {},
            "processed_ticket": None,
            "error": None,
            "status": "started"
        }
        
        # Run the workflow
        final_state = await self.workflow.ainvoke(initial_state)
        
        # Return the processed ticket
        return final_state["processed_ticket"]
            
    async def get_embeddings(self, text: str) -> List[float]:
        """Generate embeddings for text using OpenAI."""
        return await self.embeddings.aembed_query(text)
        
    async def prepare_for_vectordb(self, ticket: TicketData) -> Dict[str, Any]:
        """Prepare ticket for storage in ChromaDB."""
        # Convert ticket to document format
        document = ticket.to_chroma_document()
        
        # Generate embeddings for the document text
        if document["text"]:
            embeddings = await self.get_embeddings(document["text"])
            document["embeddings"] = embeddings
            
        return document 