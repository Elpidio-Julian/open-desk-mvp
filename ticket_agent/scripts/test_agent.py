from ticket_agent.src.agent import TicketRoutingAgent
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def print_result(test_name: str, result: dict):
    """Pretty print the test results"""
    logger.info(f"\nTest Case: {test_name}")
    logger.info("=" * 50)
    logger.info(f"Input: {result.get('input', 'N/A')}")
    logger.info("-" * 50)
    logger.info("Output:")
    logger.info(result.get('output', 'No output'))
    logger.info("=" * 50)

def run_tests():
    """Run a series of tests on the ticket routing agent"""
    logger.info("Initializing TicketRoutingAgent...")
    agent = TicketRoutingAgent()
    
    test_cases = [
        {
            "name": "Password Reset",
            "content": "I need to reset my password urgently. I can't log in to my account."
        },
        {
            "name": "System Outage",
            "content": "The entire system is down. None of our users can access it."
        },
        {
            "name": "Ambiguous Login Issue",
            "content": "Having trouble logging in. Sometimes it works, sometimes it doesn't."
        },
        {
            "name": "Performance Issue",
            "content": "The application is running very slowly when processing large files."
        }
    ]
    
    success_count = 0
    total_tests = len(test_cases)
    
    for test in test_cases:
        try:
            result = agent.process_ticket(test["content"])
            print_result(test["name"], result)
            success_count += 1
        except Exception as e:
            logger.error(f"\nError processing ticket: {str(e)}")
            logger.error(f"Test case: {test['name']} failed\n")
    
    logger.info("\nTest Summary")
    logger.info("=" * 50)
    logger.info(f"Tests Passed: {success_count}/{total_tests}")
    logger.info("=" * 50)

if __name__ == "__main__":
    run_tests() 