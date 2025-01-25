import unittest
from src.utils.db import VectorStore
import os

class TestVectorStore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Initialize vector store once for all tests"""
        cls.vector_store = VectorStore()

    def test_1_initial_connection(self):
        """Test if we can connect to ChromaDB and create collection"""
        self.assertIsNotNone(self.vector_store.collection)
        self.assertEqual(self.vector_store.collection.name, "tickets")

    def test_2_example_tickets_loaded(self):
        """Test if example tickets were loaded"""
        count = self.vector_store.collection.count()
        self.assertGreater(count, 0, "Collection should contain example tickets")

    def test_3_similarity_search(self):
        """Test similarity search functionality"""
        # Test password reset query
        query = "I need to reset my password"
        results = self.vector_store.similar_tickets(query)
        
        self.assertTrue(len(results) > 0, "Should return at least one result")
        
        # Check result format
        first_result = results[0]
        self.assertEqual(len(first_result), 2, "Result should be (document, score) tuple")
        self.assertTrue(0 <= first_result[1] <= 1, "Similarity score should be between 0 and 1")
        
        # Check if the most similar result is actually about password reset
        self.assertIn("password", first_result[0].page_content.lower())

    def test_4_add_and_retrieve_ticket(self):
        """Test adding a new ticket and retrieving it"""
        # Add new ticket
        content = "My application keeps crashing when I try to save files"
        metadata = {
            "id": "test_1",
            "category": "application_error",
            "can_autoresolve": False
        }
        
        ticket_id = self.vector_store.add_ticket(content, metadata)
        self.assertIsNotNone(ticket_id)
        
        # Retrieve the ticket
        retrieved_ticket = self.vector_store.get_ticket(ticket_id)
        self.assertIsNotNone(retrieved_ticket)
        
        # Search for the new ticket
        results = self.vector_store.similar_tickets("application crash")
        self.assertTrue(len(results) > 0)
        found_similar = any("crash" in result[0].page_content.lower() for result in results)
        self.assertTrue(found_similar, "Should find the newly added ticket")

    def test_5_error_handling(self):
        """Test error handling for invalid operations"""
        # Test invalid ticket ID
        with self.assertRaises(ValueError) as context:
            self.vector_store.get_ticket("non_existent_id")
        self.assertIn("No ticket found", str(context.exception))

if __name__ == '__main__':
    unittest.main(verbosity=2) 