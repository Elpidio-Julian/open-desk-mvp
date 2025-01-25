import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.db import VectorStore

def main():
    # Initialize vector store
    vs = VectorStore()
    
    # Try a search
    query = "password reset"
    print(f"\nSearching for: {query}")
    results = vs.similar_tickets(query)
    
    for doc, score in results:
        print(f"\nScore: {score:.4f}")
        print(f"Content: {doc.page_content}")
        print(f"Metadata: {doc.metadata}")

if __name__ == "__main__":
    main() 