from typing import Dict, Any, Optional, List
from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel
from services.vector_store import VectorStore
from supabase_client import SupabaseClient
from langchain_openai import ChatOpenAI
from langchain.chat_models.base import BaseChatModel
from datetime import datetime

class TicketInput(BaseModel):
    ticket_id: str

class TicketRetrieverTool:
    """Tool for retrieving ticket data from Supabase."""
    
    def __init__(self):
        self.supabase = SupabaseClient()
    
    async def get_ticket(self, ticket_id: str) -> Dict[str, Any]:
        """Get ticket data from Supabase."""
        try:
            print(f"\nFetching ticket {ticket_id} from Supabase")
            response = self.supabase.client.from_("tickets").select("*").eq("id", ticket_id).execute()
            
            if response.data and len(response.data) > 0:
                print(f"Found ticket data: {response.data[0]}")
                return response.data[0]
            
            print(f"No ticket found with ID {ticket_id}")
            return {"error": "Ticket not found"}
        except Exception as e:
            print(f"Error retrieving ticket: {str(e)}")
            return {"error": str(e)}

class VectorSearchTool:
    """Tool for finding similar tickets using vector search."""
    
    def __init__(self):
        self.vector_store = VectorStore()
    
    async def find_similar(self, query_text: str, n_results: int = 5) -> list:
        """Find similar tickets using vector search."""
        try:
            print(f"\nSearching for similar tickets with query: {query_text}")
            similar_docs = await self.vector_store.find_similar_documents(
                query_text=query_text,
                n_results=n_results
            )
            print(f"Found similar documents: {similar_docs}")
            return similar_docs if similar_docs else []
        except Exception as e:
            print(f"Error in vector search: {str(e)}")
            return []

class ClassificationTool:
    """Tool for classifying if a ticket can be auto-resolved."""
    
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.supabase = SupabaseClient()
        self.llm = ChatOpenAI()  # Initialize with default settings
        self.auto_resolve_threshold = 0.8
        self._teams_cache = None
        self._teams_cache_time = None
    
    async def _get_available_teams(self) -> List[str]:
        """Fetch available teams from the database with caching."""
        # Cache teams for 5 minutes to avoid frequent db calls
        current_time = datetime.utcnow()
        if (self._teams_cache is not None and 
            self._teams_cache_time is not None and 
            (current_time - self._teams_cache_time).total_seconds() < 300):
            return self._teams_cache

        try:
            # Fetch teams from Supabase
            response = await self.supabase.client.table('teams').select('name').execute()
            teams = [team['name'] for team in response.data]
            
            if not teams:  # Fallback if no teams configured
                teams = ["general_support"]
            
            self._teams_cache = teams
            self._teams_cache_time = current_time
            return teams
        except Exception as e:
            print(f"Error fetching teams: {e}")
            return ["general_support"]  # Fallback to general support on error
    
    async def _get_routing_rules(self) -> List[Dict[str, Any]]:
        """Get routing rules from custom_field_definitions table."""
        try:
            print("\nFetching routing rules from custom_field_definitions")
            response = self.supabase.client.from_("custom_field_definitions") \
                .select("*") \
                .eq("content_type", "routing_rules") \
                .eq("is_active", True) \
                .execute()
            
            rules = response.data
            print(f"Found {len(rules)} active routing rules")
            for rule in rules:
                print(f"Rule: {rule['name']} - {rule['description']}")
            return rules
        except Exception as e:
            print(f"Error fetching routing rules: {str(e)}")
            return []
    
    def _check_conditions(self, ticket_data: Dict[str, Any], rule: Dict[str, Any]) -> bool:
        """Check if ticket matches rule conditions."""
        print(f"\nChecking conditions for rule: {rule['name']}")
        conditions = rule.get("options", {}).get("conditions", {})
        
        # Check priority
        rule_priority = conditions.get("priority")
        ticket_priority = ticket_data.get("priority")
        if rule_priority and ticket_priority != rule_priority:
            print(f"Priority mismatch: rule={rule_priority}, ticket={ticket_priority}")
            return False
            
        # Check tags
        ticket_tags = set(ticket_data.get("metadata", {}).get("tags", []))
        required_tags = set(conditions.get("tags", []))
        if required_tags and not required_tags.issubset(ticket_tags):
            print(f"Tags mismatch: required={required_tags}, ticket={ticket_tags}")
            return False
            
        # Check custom fields
        ticket_custom_fields = ticket_data.get("metadata", {})
        required_custom_fields = conditions.get("custom_fields", {})
        for field, value in required_custom_fields.items():
            if ticket_custom_fields.get(field) != value:
                print(f"Custom field mismatch: {field}={value}, ticket={ticket_custom_fields.get(field)}")
                return False
        
        print("All conditions match")
        return True
    
    async def _should_auto_resolve(self, rule: Dict[str, Any], ticket_data: Dict[str, Any]) -> bool:
        """Use LLM to determine if ticket should be auto-resolved based on rule description."""
        prompt = f"""You are evaluating if a support ticket can be auto-resolved based on a specific rule.

Rule Description:
"{rule['description']}"

This rule specifically allows auto-resolution for:
1. Password changes
2. Full name profile changes
3. Information-only requests that don't require feature changes

Ticket Details:
Title: {ticket_data.get('title')}
Description: {ticket_data.get('description')}
Priority: {ticket_data.get('priority')}
Status: {ticket_data.get('status')}
Category: {ticket_data.get('metadata', {}).get('Issue Category')}
Tags: {ticket_data.get('metadata', {}).get('tags', [])}

Evaluation Steps:
1. Is this ticket about password changes or full name changes? If yes, it should be auto-resolved.
2. If not, check if this is an information-only request:
   - Does the user just need information or instructions?
   - Are they asking "how to" do something?
   - Do they only need documentation or steps?
   If ANY of these are true AND no system changes are needed, it should be auto-resolved.
3. Does this require any human approval, system changes, or feature development? If yes, it should NOT be auto-resolved.

Answer with ONLY 'true' if the ticket matches the auto-resolve criteria in the rule, or 'false' if it does not.
Remember: 
- Password resets and name changes should ALWAYS be auto-resolved according to the rule
- Simple information requests that don't require changes should be auto-resolved
- If they just need instructions or documentation, that's auto-resolvable"""

        response = await self.llm.ainvoke(prompt)
        result = response.content.strip().lower() == 'true'
        print(f"LLM auto-resolve decision for rule '{rule['name']}': {result}")
        if not result:
            print("LLM reasoning:", response.content.strip())
        return result
    
    async def _infer_team_routing(self, rule: Dict[str, Any], ticket_data: Dict[str, Any]) -> str:
        """Use LLM to infer the appropriate team based on rule description and ticket content."""
        # Get current available teams
        available_teams = await self._get_available_teams()
        teams_description = "\n".join(f"- {team}" for team in available_teams)
        
        prompt = f"""You are determining which support team should handle a ticket based on its content and the matching rule.

Rule Description:
"{rule['description']}"

Ticket Details:
Title: {ticket_data.get('title')}
Description: {ticket_data.get('description')}
Priority: {ticket_data.get('priority')}
Category: {ticket_data.get('metadata', {}).get('Issue Category')}
Tags: {ticket_data.get('metadata', {}).get('tags', [])}

Available Teams:
{teams_description}

Based on the rule description and ticket content, determine the most appropriate team to handle this ticket.
Consider:
1. The type of issue described
2. Required expertise to handle the issue
3. Historical handling of similar issues
4. Complexity and technical depth needed

Return ONLY ONE team name from the available teams list above, with no additional explanation."""

        response = await self.llm.ainvoke(prompt)
        team = response.content.strip().lower()
        
        # Validate team name against current available teams
        if team not in available_teams:
            print(f"Invalid team name returned by LLM: {team}, defaulting to {available_teams[0]}")
            team = available_teams[0]
            
        print(f"Inferred team for rule '{rule['name']}': {team}")
        return team

    async def classify_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """Classify if a ticket can be auto-resolved based on routing rules and similar tickets."""
        try:
            print(f"\nClassifying ticket: {ticket_data}")
            if "error" in ticket_data:
                return {
                    "can_auto_resolve": False,
                    "confidence": 0.0,
                    "error": ticket_data["error"],
                    "metadata_updates": {
                        "auto_resolution": {
                            "is_auto_resolvable": False,
                            "error": ticket_data["error"],
                            "processed_at": datetime.utcnow().isoformat(),
                            "status": "requires_human",
                            "routing": {
                                "team": await self._infer_team_routing({"name": "error", "description": "Error handling rule"}, ticket_data),
                                "priority": "high",
                                "reason": "retrieval_error"
                            }
                        }
                    }
                }
            
            # Get routing rules
            rules = await self._get_routing_rules()
            
            # Check each rule
            for rule in rules:
                if self._check_conditions(ticket_data, rule):
                    print(f"Ticket matches conditions for rule: {rule['name']}")
                    
                    # Infer team routing
                    team = await self._infer_team_routing(rule, ticket_data)
                    
                    if await self._should_auto_resolve(rule, ticket_data):
                        # Find similar tickets for confidence check
                        query_text = f"{ticket_data.get('title', '')} {ticket_data.get('description', '')}"
                        similar_tickets = await self.vector_store.find_similar_documents(
                            query_text=query_text,
                            n_results=3
                        )
                        
                        # Calculate confidence from similarity scores
                        similarity_scores = [doc.get('similarity_score', 0) for doc in similar_tickets]
                        max_similarity = max(similarity_scores) if similarity_scores else 0
                        can_auto_resolve = max_similarity >= self.auto_resolve_threshold
                        
                        # Prepare metadata structure
                        metadata_updates = {
                            "auto_resolution": {
                                "is_auto_resolvable": can_auto_resolve,
                                "confidence": max_similarity,
                                "matching_rule": rule['name'],
                                "processed_at": datetime.utcnow().isoformat(),
                            }
                        }
                        
                        if can_auto_resolve:
                            metadata_updates["auto_resolution"].update({
                                "status": "resolved",
                                "resolution_type": "automatic",
                                "resolution_details": {
                                    "similar_tickets": [t["ticket_id"] for t in similar_tickets],
                                    "reason": "high_confidence_match"
                                }
                            })
                        else:
                            metadata_updates["auto_resolution"].update({
                                "status": "requires_human",
                                "routing": {
                                    "team": team,
                                    "priority": ticket_data.get("priority", "medium"),
                                    "reason": "low_confidence_match"
                                }
                            })
                        
                        return {
                            "can_auto_resolve": can_auto_resolve,
                            "confidence": max_similarity,
                            "similar_tickets": similar_tickets,
                            "matching_rule": rule['name'],
                            "reason": "high_confidence_match" if can_auto_resolve else "low_confidence_match",
                            "metadata_updates": metadata_updates
                        }
            
            # If no rules match, infer team from ticket content with a generic rule
            default_rule = {
                "name": "default",
                "description": "Default routing rule for unmatched tickets"
            }
            default_team = await self._infer_team_routing(default_rule, ticket_data)
            
            return {
                "can_auto_resolve": False,
                "confidence": 0.0,
                "similar_tickets": [],
                "reason": "no_matching_rules",
                "metadata_updates": {
                    "auto_resolution": {
                        "is_auto_resolvable": False,
                        "confidence": 0.0,
                        "processed_at": datetime.utcnow().isoformat(),
                        "status": "requires_human",
                        "routing": {
                            "team": default_team,
                            "priority": ticket_data.get("priority", "medium"),
                            "reason": "no_matching_rules"
                        }
                    }
                }
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"Error classifying ticket: {error_msg}")
            return {
                "can_auto_resolve": False,
                "confidence": 0.0,
                "error": error_msg,
                "metadata_updates": {
                    "auto_resolution": {
                        "is_auto_resolvable": False,
                        "error": error_msg,
                        "processed_at": datetime.utcnow().isoformat(),
                        "status": "requires_human",
                        "routing": {
                            "team": "technical_support",  # Default to technical support for errors
                            "priority": "high",
                            "reason": "classification_error"
                        }
                    }
                }
            }

# Create tool instances
def get_ticket_tools():
    """Get all ticket-related tools."""
    vector_store = VectorStore()
    
    return [
        StructuredTool.from_function(
            func=TicketRetrieverTool().get_ticket,
            name="ticket_retriever",
            description="Retrieve ticket data from the database using ticket ID"
        ),
        StructuredTool.from_function(
            func=VectorSearchTool().find_similar,
            name="vector_search",
            description="Search for similar tickets using vector similarity"
        ),
        StructuredTool.from_function(
            func=ClassificationTool(vector_store).classify_ticket,
            name="ticket_classifier",
            description="Classify if a ticket can be auto-resolved"
        )
    ] 