from setuptools import setup, find_packages

setup(
    name="ticket_agent",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "langchain>=0.1.0",
        "langchain-community>=0.0.10",
        "langchain-openai>=0.0.5",
        "chromadb>=0.4.22",
        "langchain-chroma>=0.0.5",
        "python-dotenv>=1.0.0"
    ]
) 