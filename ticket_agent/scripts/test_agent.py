from ticket_agent.src.agent import TicketRoutingAgent
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def print_result(test_name: str, result: dict):
    """Pretty print the test results"""
    logger.info(f"\nTest Case: {test_name}")
    logger.info("=" * 80)
    logger.info(f"Input: {result.get('input', 'N/A')}")
    logger.info("-" * 80)
    logger.info("Output:")
    logger.info(result.get('output', 'No output'))
    logger.info("=" * 80)

def run_tests():
    """Run a series of tests on the ticket routing agent"""
    logger.info("Initializing TicketRoutingAgent...")
    agent = TicketRoutingAgent()
    
    test_cases = [
        {
            "name": "Critical System Outage",
            "content": "URGENT: The entire production system is down! All users are getting 500 errors. This is severely impacting our business operations and needs immediate attention!"
        },
        {
            "name": "Simple Password Reset",
            "content": "Hi, I forgot my password and need to reset it. This isn't urgent but I'd appreciate help when possible."
        },
        {
            "name": "Security Incident",
            "content": "CRITICAL SECURITY ALERT: We've detected unauthorized access attempts from multiple IP addresses. Possible breach in progress."
        },
        {
            "name": "Feature Request",
            "content": "Would it be possible to add dark mode to the dashboard? This would help reduce eye strain when working late."
        },
        {
            "name": "Complex Performance Issue",
            "content": "The application has been getting progressively slower over the past week. Response times have increased by 300% and we're seeing memory leaks. Multiple microservices are affected."
        },
        {
            "name": "Billing Issue",
            "content": "Our latest invoice shows charges for services we don't use. Need help reviewing and adjusting the billing statement."
        },
        {
            "name": "Account Management",
            "content": "Need to add 5 new team members to our enterprise account and set up proper access permissions."
        }
    ]
    
    success_count = 0
    total_tests = len(test_cases)
    
    for test in test_cases:
        try:
            logger.info(f"\nProcessing: {test['name']}")
            logger.info("-" * 80)
            result = agent.process_ticket(test["content"])
            print_result(test["name"], result)
            success_count += 1
        except Exception as e:
            logger.error(f"\nError processing ticket: {str(e)}")
            logger.error(f"Test case: {test['name']} failed\n")
    
    logger.info("\nTest Summary")
    logger.info("=" * 80)
    logger.info(f"Tests Passed: {success_count}/{total_tests}")
    logger.info("=" * 80)

if __name__ == "__main__":
    run_tests() 