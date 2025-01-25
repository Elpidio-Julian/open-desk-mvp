from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
import chromadb
import json
import os
from dotenv import load_dotenv

load_dotenv()

class VectorStore:
    def __init__(self):
        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small"
        )
        
        # Initialize Chroma client
        self.client = chromadb.HttpClient(
            ssl=True,
            host=os.getenv('CHROMA_HOST'),
            tenant=os.getenv('CHROMA_TENANT'),
            database=os.getenv('CHROMA_DATABASE'),
            headers={
                'x-chroma-token': os.getenv('CHROMA_API_KEY')
            }
        )
        
        try:
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name="tickets",
                metadata={"desc": "tickets"}
            )
            print(f"Successfully connected to collection: {self.collection.name}")
            
            # Initialize Langchain's Chroma integration
            self.db = Chroma(
                client=self.client,
                collection_name="tickets",
                embedding_function=self.embeddings
            )
            
            # Load example tickets if collection is empty
            if self.collection.count() == 0:
                self._load_example_tickets()
                
        except Exception as e:
            print(f"Error initializing ChromaDB: {str(e)}")
            raise

    def _load_example_tickets(self):
        """Load example tickets into vector store"""
        try:
            with open("./data/example_tickets.json", "r") as f:
                data = json.load(f)
            
            # Generate unique IDs for documents
            ids = [str(i) for i in range(len(data["tickets"]))]
            texts = []
            metadatas = []
            
            for ticket in data["tickets"]:
                texts.append(ticket["content"])
                metadatas.append({
                    "id": ticket["id"],
                    "category": ticket["category"],
                    "can_autoresolve": ticket["can_autoresolve"]
                })
            
            # Get embeddings directly
            embeddings = self.embeddings.embed_documents(texts)
            
            # Add to collection using ChromaDB client directly
            self.collection.add(
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
                ids=ids
            )
            
            # Reinitialize Langchain's store
            self.db = Chroma(
                client=self.client,
                collection_name="tickets",
                embedding_function=self.embeddings
            )
            
            print(f"Loaded {len(texts)} example tickets")
            
        except Exception as e:
            print(f"Error loading example tickets: {str(e)}")
            raise

    def similar_tickets(self, query: str, k: int = 3):
        """Find similar tickets to the query"""
        try:
            results = self.db.similarity_search_with_score(
                query=query,
                k=k
            )
            return results
        except Exception as e:
            print(f"Error in similarity search: {str(e)}")
            raise

    def add_ticket(self, content: str, metadata: dict):
        """Add a new ticket to the vector store"""
        try:
            # Generate a unique ID for the new ticket
            ticket_id = str(self.collection.count() + 1)
            
            # Get embeddings directly
            embeddings = self.embeddings.embed_documents([content])
            
            # Add to collection using ChromaDB client directly
            self.collection.add(
                embeddings=embeddings,
                documents=[content],
                metadatas=[metadata],
                ids=[ticket_id]
            )
            
            # Keep Langchain's store in sync
            self.db = Chroma(
                client=self.client,
                collection_name="tickets",
                embedding_function=self.embeddings
            )
            
            print(f"Added ticket with ID: {ticket_id}")
            return ticket_id
            
        except Exception as e:
            print(f"Error adding ticket: {str(e)}")
            raise

    def get_ticket(self, ticket_id: str):
        """Retrieve a specific ticket by ID"""
        try:
            result = self.collection.get(
                ids=[ticket_id]
            )
            # ChromaDB returns empty lists for non-existent IDs
            if not result['ids']:
                raise ValueError(f"No ticket found with ID: {ticket_id}")
            return result
        except Exception as e:
            print(f"Error retrieving ticket: {str(e)}")
            raise 