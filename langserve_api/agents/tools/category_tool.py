from typing import Dict, Any, List, Tuple, ClassVar
from pydantic import BaseModel
from langchain.tools import BaseTool
import re

class CategoryClassificationResult(BaseModel):
    """Result of category classification."""
    category: str
    confidence: float
    reasons: List[str]
    matched_patterns: Dict[str, List[str]]

class CategoryClassificationTool(BaseTool):
    name: str = "category_classification"
    description: str = "Classify ticket into predefined categories"
    
    # Category patterns with weighted scores
    CATEGORY_PATTERNS: ClassVar[Dict[str, List[Tuple[str, float]]]] = {
        "Authentication": [
            (r"(?i)(login|auth.*error|access.*denied|permission|403|401)", 1.0),
            (r"(?i)(cannot\s+access|credentials|password)", 0.8),
            (r"(?i)(session|token|oauth)", 0.7)
        ],
        "Technical": [
            (r"(?i)(error|exception|crash|bug(?!\s*report))", 0.8),
            (r"(?i)(integration|api|endpoint|service)", 0.7),
            (r"(?i)(configuration|setup|install)", 0.6)
        ],
        "Billing": [
            (r"(?i)(payment|invoice|charge|subscription|billing)", 1.0),
            (r"(?i)(price|cost|fee|credit card)", 0.8),
            (r"(?i)(upgrade|downgrade|plan)", 0.7)
        ],
        "Account Management": [
            (r"(?i)(account.*settings?|profile|preferences)", 0.8),
            (r"(?i)(user.*management|role|permission)", 0.7),
            (r"(?i)(team|organization|workspace)", 0.6)
        ],
        "Feature Request": [
            (r"(?i)(feature.*request|would\s+like|suggestion)", 1.0),
            (r"(?i)(new\s+feature|add.*capability|enhance)", 0.8),
            (r"(?i)(improvement|nice\s+to\s+have)", 0.7)
        ],
        "Bug": [
            (r"(?i)(bug|not\s+working|broken|issue)", 0.9),
            (r"(?i)(unexpected|behavior|wrong)", 0.7),
            (r"(?i)(regression|defect)", 0.8)
        ],
        "Performance": [
            (r"(?i)(slow|performance|latency|timeout)", 1.0),
            (r"(?i)(response\s+time|load.*time|speed)", 0.8),
            (r"(?i)(memory|cpu|resource)", 0.7)
        ],
        "Documentation": [
            (r"(?i)(documentation|docs|guide|tutorial)", 1.0),
            (r"(?i)(explain|clarify|how\s+to)", 0.8),
            (r"(?i)(example|reference|help)", 0.7)
        ]
    }

    def _check_category_patterns(self, text: str) -> Dict[str, List[Tuple[str, float]]]:
        """Check text against patterns for each category."""
        matches = {}
        for category, patterns in self.CATEGORY_PATTERNS.items():
            category_matches = []
            for pattern, weight in patterns:
                if found_matches := re.findall(pattern, text):
                    category_matches.extend((match, weight) for match in found_matches)
            if category_matches:
                matches[category] = category_matches
        return matches

    def _calculate_category_scores(self, matches: Dict[str, List[Tuple[str, float]]]) -> Dict[str, float]:
        """Calculate confidence scores for each category."""
        scores = {}
        for category, category_matches in matches.items():
            # Calculate weighted score
            total_weight = sum(weight for _, weight in category_matches)
            # Normalize by number of patterns for the category
            score = total_weight / len(self.CATEGORY_PATTERNS[category])
            scores[category] = min(score, 1.0)  # Cap at 1.0
        return scores

    def _analyze_content(self, title: str, description: str) -> CategoryClassificationResult:
        """Analyze ticket content for category classification."""
        # Combine title and description for analysis
        full_text = f"{title} {description}"
        
        # Find all pattern matches
        matches = self._check_category_patterns(full_text)
        
        # Calculate confidence scores
        scores = self._calculate_category_scores(matches)
        
        if not scores:
            return CategoryClassificationResult(
                category="Technical",  # Default category
                confidence=0.5,
                reasons=["No clear category indicators found"],
                matched_patterns={}
            )
        
        # Select category with highest score
        best_category = max(scores.items(), key=lambda x: x[1])
        category, confidence = best_category
        
        # Prepare matched patterns for output
        matched_patterns = {
            cat: [match for match, _ in cat_matches]
            for cat, cat_matches in matches.items()
        }
        
        # Generate reasons
        reasons = [
            f"Found {len(cat_matches)} matches for {cat} category: {', '.join(match for match, _ in cat_matches)}"
            for cat, cat_matches in matches.items()
            if cat == category
        ]
        
        return CategoryClassificationResult(
            category=category,
            confidence=confidence,
            reasons=reasons,
            matched_patterns=matched_patterns
        )

    def _run(self, title: str, description: str) -> Dict[str, Any]:
        """Run category classification on ticket content."""
        result = self._analyze_content(title, description)
        return result.model_dump()

    async def arun(self, title: str, description: str) -> Dict[str, Any]:
        """Async run category classification on ticket content."""
        return self._run(title=title, description=description)
        
    def run(self, title: str, description: str) -> Dict[str, Any]:
        """Run category classification on ticket content."""
        return self._run(title=title, description=description) 