import json
from typing import Any, Dict

def format_llm_response(response: str) -> str:
    """Format LLM response for debugging."""
    try:
        # Try to parse as JSON for pretty printing
        parsed = json.loads(response)
        return json.dumps(parsed, indent=2)
    except:
        return response

def compare_metadata(expected: Dict[str, Any], actual: Dict[str, Any]) -> Dict[str, Any]:
    """Compare expected and actual metadata, return differences."""
    differences = {}
    for key in set(expected.keys()) | set(actual.keys()):
        if key not in expected:
            differences[key] = f"Unexpected: {actual[key]}"
        elif key not in actual:
            differences[key] = f"Missing: {expected[key]}"
        elif expected[key] != actual[key]:
            differences[key] = f"Expected: {expected[key]}, Got: {actual[key]}"
    return differences

def debug_ticket_processing(title: str, description: str, result: Any, expected: Dict[str, Any]) -> str:
    """Create detailed debug output for ticket processing."""
    debug_info = [
        "=== Ticket Processing Debug ===",
        f"Input:",
        f"  Title: {title}",
        f"  Description: {description}",
        f"\nExpected:",
        f"  Priority: {expected.get('expected_priority')}",
        f"  Category: {expected.get('expected_category')}",
        f"  Tags: {expected.get('expected_tags')}",
        f"\nResult:",
        f"  Priority: {result.priority}",
        f"  Category: {result.metadata.Issue_Category}",
        f"  Tags: {result.metadata.ticket_tags}",
    ]
    return "\n".join(debug_info) 