import os
import pytest
from dotenv import load_dotenv

def pytest_configure(config):
    """Setup test configuration."""
    # Load environment variables
    load_dotenv()
    
    # Ensure required environment variables are set
    required_vars = [
        "OPENAI_API_KEY",
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        pytest.exit(f"Missing required environment variables: {', '.join(missing_vars)}")
        
@pytest.fixture(autouse=True)
def env_setup():
    """Setup test environment variables if not already set."""
    # Set default values for testing if not set
    os.environ.setdefault("OPENAI_API_MODEL", "gpt-3.5-turbo")
    # Add more default environment variables as needed 