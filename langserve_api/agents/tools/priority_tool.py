from typing import Dict, Any, List, Tuple, ClassVar
from pydantic import BaseModel, Field
from langchain.tools import BaseTool
import re

class PriorityAssessmentResult(BaseModel):
    """Result of priority assessment."""
    priority: str
    confidence: float
    reasons: List[str]
    indicators: Dict[str, List[str]]

class PriorityAssessmentTool(BaseTool):
    name: str = "priority_assessment"
    description: str = "Assess ticket priority based on content analysis"
    
    # Priority patterns
    HIGH_PRIORITY_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)cannot\s+(?:access|login)|login.*(?:fail|error|issue)|access.*denied", "login/access issue"),
        (r"(?i)403|401|500|auth.*error|permission.*denied", "authentication error"),
        (r"(?i)security|breach|hack|unauthorized|attack", "security concern"),
        (r"(?i)all\s+users|everyone|system.*down|production.*down", "system-wide impact"),
        (r"(?i)data.*loss|corruption|missing.*data", "data issue")
    ]
    
    MEDIUM_PRIORITY_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)(?<!feature\s)(?<!enhancement\s)(bug|error|issue|problem|not\s+working)", "functional issue"),
        (r"(?i)slow|performance|latency|timeout", "performance issue"),
        (r"(?i)ui|display|visual|layout.*(?:problem|issue|bug)", "UI problem")
    ]
    
    LOW_PRIORITY_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)feature.*request|enhancement.*request|would\s+like|nice\s+to\s+have", "feature request"),
        (r"(?i)dark.*mode|theme|color.*scheme", "UI enhancement"),
        (r"(?i)document|docs|help|explain", "documentation"),
        (r"(?i)cosmetic|style|look.*feel", "cosmetic issue")
    ]

    def _check_patterns(self, text: str, patterns: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
        """Check text against a list of regex patterns."""
        matches = []
        for pattern, reason in patterns:
            if re.search(pattern, text):
                # Find all specific matches
                specific_matches = re.findall(pattern, text)
                matches.append((reason, specific_matches))
        return matches

    def _analyze_content(self, title: str, description: str) -> PriorityAssessmentResult:
        """Analyze ticket content for priority indicators."""
        # Combine title and description for analysis
        full_text = f"{title} {description}"
        
        # Check against all patterns
        high_matches = self._check_patterns(full_text, self.HIGH_PRIORITY_PATTERNS)
        medium_matches = self._check_patterns(full_text, self.MEDIUM_PRIORITY_PATTERNS)
        low_matches = self._check_patterns(full_text, self.LOW_PRIORITY_PATTERNS)
        
        # Determine priority based on matches
        indicators = {
            "high": [reason for reason, _ in high_matches],
            "medium": [reason for reason, _ in medium_matches],
            "low": [reason for reason, _ in low_matches]
        }
        
        # Special case handling
        if any("feature request" in reason or "UI enhancement" in reason for reason in indicators["low"]):
            priority = "low"
            confidence = 0.9
            reasons = ["Feature request or UI enhancement detected"]
        elif any("login/access issue" in reason or "authentication error" in reason for reason in indicators["high"]):
            priority = "high"
            confidence = 0.9
            reasons = ["Login/authentication issue detected"]
        elif high_matches:
            priority = "high"
            confidence = 0.9 if len(high_matches) > 1 else 0.8
            reasons = [f"Found {reason}: {', '.join(matches)}" 
                      for reason, matches in high_matches]
        elif low_matches and not medium_matches:
            priority = "low"
            confidence = 0.8 if len(low_matches) > 1 else 0.7
            reasons = [f"Found {reason}: {', '.join(matches)}" 
                      for reason, matches in low_matches]
        elif medium_matches:
            priority = "medium"
            confidence = 0.8 if len(medium_matches) > 1 else 0.7
            reasons = [f"Found {reason}: {', '.join(matches)}" 
                      for reason, matches in medium_matches]
        else:
            priority = "medium"  # Default to medium if no clear indicators
            confidence = 0.5
            reasons = ["No clear priority indicators found"]
        
        return PriorityAssessmentResult(
            priority=priority,
            confidence=confidence,
            reasons=reasons,
            indicators=indicators
        )

    def _run(self, title: str, description: str) -> Dict[str, Any]:
        """Run priority assessment on ticket content."""
        result = self._analyze_content(title, description)
        return result.model_dump()

    async def arun(self, title: str, description: str) -> Dict[str, Any]:
        """Async run priority assessment on ticket content."""
        return self._run(title=title, description=description)
        
    def run(self, title: str, description: str) -> Dict[str, Any]:
        """Run priority assessment on ticket content."""
        return self._run(title=title, description=description) 