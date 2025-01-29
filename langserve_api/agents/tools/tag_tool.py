from typing import Dict, Any, List, Set, ClassVar, Tuple, Optional
from pydantic import BaseModel, Field
from langchain.tools import BaseTool
import re
import spacy
from collections import defaultdict

class TagExtractionResult(BaseModel):
    """Result of tag extraction."""
    tags: List[str]
    technical_terms: List[str]
    key_entities: List[str]
    browser: str | None = None
    platform: str | None = None
    confidence: float
    reasons: List[str]

class TagExtractionTool(BaseTool):
    name: str = "tag_extraction"
    description: str = "Extract relevant tags and technical terms from ticket content"
    nlp: Optional[Any] = None
    
    # Common technical patterns
    TECHNICAL_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)(\d{3})", "error_code"),  # HTTP error codes - capture just the number
        (r"(?i)(admin\s+dashboard|user\s+dashboard|customer\s+dashboard)", "dashboard"),  # Specific dashboard types
        (r"(?i)(api|endpoint|service|server)", "component"),
        (r"(?i)(database|query|sql)", "database"),
        (r"(?i)(memory|cpu|disk|bandwidth)", "resource"),
        (r"(?i)(timeout|latency|response time)", "performance"),
        (r"(?i)(bug|crash|exception|error)", "issue_type"),
        (r"(?i)(ui|interface|button|form)", "interface"),
        (r"(?i)(auth|login|access|permission)", "authentication"),
        (r"(?i)(data|record|file|document)", "data"),
        (r"(?i)(config|setting|preference)", "configuration")
    ]
    
    # Browser patterns
    BROWSER_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)(chrome|google chrome)", "Chrome"),
        (r"(?i)(firefox|mozilla)", "Firefox"),
        (r"(?i)(safari|apple.*browser)", "Safari"),
        (r"(?i)(edge|microsoft.*edge)", "Edge"),
        (r"(?i)(ie|internet explorer)", "Internet Explorer"),
        (r"(?i)(opera)", "Opera")
    ]
    
    # Platform patterns
    PLATFORM_PATTERNS: ClassVar[List[Tuple[str, str]]] = [
        (r"(?i)(windows|win\s*\d+)", "Windows"),
        (r"(?i)(mac\s*os|macos|apple.*computer)", "MacOS"),
        (r"(?i)(linux|ubuntu|debian|centos|fedora)", "Linux"),
        (r"(?i)(ios|iphone|ipad)", "iOS"),
        (r"(?i)(android)", "Android")
    ]
    
    def __init__(self):
        super().__init__()
        # Load spaCy model for entity recognition
        try:
            import spacy
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except OSError:
                # If model not found, download it
                import subprocess
                subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
                self.nlp = spacy.load("en_core_web_sm")
        except Exception as e:
            print(f"Warning: spaCy initialization failed: {e}")
            self.nlp = None  # We'll handle this in _extract_entities

    def _extract_technical_terms(self, text: str) -> Set[str]:
        """Extract technical terms using patterns."""
        terms = set()
        for pattern, term_type in self.TECHNICAL_PATTERNS:
            matches = re.finditer(pattern, text)
            for match in matches:
                # Get the actual matched text rather than applying any transformation
                term = match.group(1).strip()
                terms.add(term)
        return terms

    def _detect_browser(self, text: str) -> str | None:
        """Detect browser mentions in text."""
        for pattern, browser in self.BROWSER_PATTERNS:
            if match := re.search(pattern, text):
                return browser
        return None

    def _detect_platform(self, text: str) -> str | None:
        """Detect platform mentions in text."""
        for pattern, platform in self.PLATFORM_PATTERNS:
            if match := re.search(pattern, text):
                return platform
        return None

    def _extract_entities(self, text: str) -> List[str]:
        """Extract named entities from text."""
        entities = set()
        if self.nlp:
            doc = self.nlp(text)
            for ent in doc.ents:
                if ent.label_ in ["PRODUCT", "ORG", "GPE", "PERSON", "WORK_OF_ART"]:
                    entities.add(ent.text.lower())
        return list(entities)

    def _generate_tags(self, technical_terms: Set[str], entities: List[str]) -> List[str]:
        """Generate normalized tags from technical terms and entities."""
        tags = set()
        
        # Add technical terms as tags
        for term in technical_terms:
            # Normalize the term
            tag = term.lower().replace(" ", "_")
            tags.add(tag)
        
        # Add relevant entities as tags
        for entity in entities:
            # Normalize the entity
            tag = entity.lower().replace(" ", "_")
            tags.add(tag)
        
        return list(tags)

    def _analyze_content(self, title: str, description: str) -> TagExtractionResult:
        """Analyze ticket content for tags and technical terms."""
        # Combine title and description for analysis
        full_text = f"{title} {description}"
        
        # Extract technical terms
        technical_terms = self._extract_technical_terms(full_text)
        
        # Extract entities
        entities = self._extract_entities(full_text)
        
        # Generate tags
        tags = self._generate_tags(technical_terms, entities)
        
        # Detect browser and platform
        browser = self._detect_browser(full_text)
        platform = self._detect_platform(full_text)
        
        # Calculate confidence based on number of findings
        total_findings = len(technical_terms) + len(entities)
        confidence = min(0.5 + (total_findings * 0.1), 1.0)
        
        # Generate reasons
        reasons = []
        if technical_terms:
            reasons.append(f"Found technical terms: {', '.join(technical_terms)}")
        if entities:
            reasons.append(f"Found entities: {', '.join(entities)}")
        if browser:
            reasons.append(f"Detected browser: {browser}")
        if platform:
            reasons.append(f"Detected platform: {platform}")
        
        if not reasons:
            reasons = ["No clear tag indicators found"]
            confidence = 0.5
        
        return TagExtractionResult(
            tags=tags[:5],  # Limit to top 5 tags
            technical_terms=list(technical_terms),
            key_entities=entities,
            browser=browser,
            platform=platform,
            confidence=confidence,
            reasons=reasons
        )

    def _run(self, title: str, description: str) -> Dict[str, Any]:
        """Run tag extraction on ticket content."""
        result = self._analyze_content(title, description)
        return result.model_dump()

    async def arun(self, title: str, description: str) -> Dict[str, Any]:
        """Async run tag extraction on ticket content."""
        return self._run(title=title, description=description)
        
    def run(self, title: str, description: str) -> Dict[str, Any]:
        """Run tag extraction on ticket content."""
        return self._run(title=title, description=description) 