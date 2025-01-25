import unittest
from src.agent import TicketRoutingAgent
import os
import shutil

class TestTicketRoutingAgent(unittest.TestCase):
    def setUp(self):
        self.agent = TicketRoutingAgent()

    def tearDown(self):
        # Clean up vector store after tests
        if os.path.exists("./data/vectorstore"):
            shutil.rmtree("./data/vectorstore")

    def test_simple_password_reset(self):
        ticket_content = "I need to reset my password for the customer portal"
        result = self.agent.process_ticket(ticket_content)
        self.assertIsNotNone(result)

    def test_ticket_classification(self):
        ticket_content = "I need to reset my password"
        classification = self.agent.classify_ticket(ticket_content)
        self.assertTrue(classification["can_autoresolve"])
        self.assertEqual(classification["category"], "password_reset")

if __name__ == '__main__':
    unittest.main() 