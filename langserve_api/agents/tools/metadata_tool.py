from typing import Dict, Any, List, Set
from pydantic import BaseModel
from langchain.tools import BaseTool
from ..models import TicketMetadata

class MetadataEnrichmentResult(BaseModel):
    """Result of metadata enrichment."""
    metadata: Dict[str, Any]
    changes: List[str]
    preserved: List[str]
    confidence: float

class MetadataEnrichmentTool(BaseTool):
    name: str = "metadata_enrichment"
    description: str = "Enrich and merge ticket metadata"
    
    def _merge_tags(self, existing_tags: List[str], new_tags: List[str]) -> List[str]:
        """Merge tag lists while preserving order and removing duplicates."""
        # Convert to sets for deduplication
        existing_set = set(existing_tags or [])
        new_set = set(new_tags or [])
        
        # Keep track of changes
        preserved = existing_set
        added = new_set - existing_set
        
        # Combine while preserving order
        result = []
        # First add existing tags (preserving their order)
        for tag in (existing_tags or []):
            result.append(tag)
        # Then add new tags that weren't in existing
        for tag in (new_tags or []):
            if tag in added:
                result.append(tag)
        
        return result

    def _merge_technical_terms(self, existing_terms: List[str], new_terms: List[str]) -> List[str]:
        """Merge technical terms while removing duplicates and near-duplicates."""
        # Convert to lowercase for comparison
        existing_lower = {term.lower(): term for term in existing_terms}
        new_lower = {term.lower(): term for term in new_terms}
        
        # Combine unique terms
        combined = {**existing_lower, **new_lower}  # New terms override existing if same lowercase
        
        return list(combined.values())

    def _merge_key_entities(self, existing_entities: List[str], new_entities: List[str]) -> List[str]:
        """Merge key entities while removing duplicates."""
        return list(set(existing_entities) | set(new_entities))

    def _analyze_metadata(self, 
                         existing_metadata: Dict[str, Any],
                         new_metadata: Dict[str, Any]) -> MetadataEnrichmentResult:
        """Analyze and merge metadata."""
        # Convert to TicketMetadata objects for easier handling
        existing = TicketMetadata(**existing_metadata)
        new = TicketMetadata(**new_metadata)
        
        result = {}
        changes = []
        preserved = []
        
        # Handle Issue_Category
        if new.Issue_Category and (not existing.Issue_Category or new.Issue_Category != existing.Issue_Category):
            result["Issue_Category"] = new.Issue_Category
            changes.append(f"Updated category to: {new.Issue_Category}")
        elif existing.Issue_Category:
            result["Issue_Category"] = existing.Issue_Category
            preserved.append(f"Preserved category: {existing.Issue_Category}")
        
        # Handle tags - preserve existing and add new
        merged_tags = self._merge_tags(existing.ticket_tags, new.ticket_tags)
        result["ticket_tags"] = merged_tags
        
        if existing.ticket_tags:
            preserved.append(f"Preserved existing tags: {', '.join(existing.ticket_tags)}")
        if set(merged_tags) - set(existing.ticket_tags or []):
            changes.append(f"Added new tags: {', '.join(set(merged_tags) - set(existing.ticket_tags or []))}")
        
        # Handle technical terms
        if new.technical_terms or existing.technical_terms:
            merged_terms = self._merge_technical_terms(
                existing.technical_terms or [],
                new.technical_terms or []
            )
            result["technical_terms"] = merged_terms
            if existing.technical_terms:
                preserved.append(f"Preserved technical terms: {', '.join(existing.technical_terms)}")
            if set(merged_terms) - set(existing.technical_terms or []):
                changes.append(f"Added technical terms: {', '.join(set(merged_terms) - set(existing.technical_terms or []))}")
        
        # Handle key entities
        if new.key_entities or existing.key_entities:
            merged_entities = self._merge_key_entities(
                existing.key_entities or [],
                new.key_entities or []
            )
            result["key_entities"] = merged_entities
        
        # Handle browser
        if new.browser and (not existing.browser or new.browser != existing.browser):
            result["browser"] = new.browser
            changes.append(f"Updated browser to: {new.browser}")
        elif existing.browser:
            result["browser"] = existing.browser
            preserved.append(f"Preserved browser: {existing.browser}")
        
        # Handle platform
        if new.platform and (not existing.platform or new.platform != existing.platform):
            result["platform"] = new.platform
            changes.append(f"Updated platform to: {new.platform}")
        elif existing.platform:
            result["platform"] = existing.platform
            preserved.append(f"Preserved platform: {existing.platform}")
        
        # Calculate confidence based on number of successful merges
        confidence = 0.5 + (0.1 * len(changes))
        confidence = min(confidence, 1.0)
        
        return MetadataEnrichmentResult(
            metadata=result,
            changes=changes,
            preserved=preserved,
            confidence=confidence
        )

    def _run(self, existing_metadata: Dict[str, Any], new_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Run metadata enrichment."""
        result = self._analyze_metadata(existing_metadata, new_metadata)
        return result.model_dump()

    async def arun(self, existing_metadata: Dict[str, Any], new_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Async run metadata enrichment."""
        return self._run(existing_metadata=existing_metadata, new_metadata=new_metadata)
        
    def run(self, existing_metadata: Dict[str, Any], new_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Run metadata enrichment."""
        return self._run(existing_metadata=existing_metadata, new_metadata=new_metadata) 