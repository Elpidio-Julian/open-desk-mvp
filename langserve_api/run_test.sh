#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set PYTHONPATH to include the current directory
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Run the test script
python scripts/test_ticket_agent.py 