#!/bin/bash

# Function to display usage
show_help() {
    echo "Usage: ./run_tests.sh [option]"
    echo "Options:"
    echo "  all         Run all tests"
    echo "  ingestion   Run only ingestion agent tests"
    echo "  classifier  Run only classifier agent tests"
    echo "  coverage    Run tests with coverage report"
    echo "  watch       Run tests in watch mode (rerun on file changes)"
    echo "  help        Show this help message"
}

# Check if pytest and requirements are installed
check_requirements() {
    if ! command -v pytest &> /dev/null; then
        echo "Installing test requirements..."
        pip install -r requirements-dev.txt
    fi
}

# Set up Python path
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Main script
check_requirements

case "$1" in
    "all")
        python -m pytest tests/ -v
        ;;
    "ingestion")
        python -m pytest tests/test_ingestion_agent.py -v
        ;;
    "classifier")
        python -m pytest tests/test_classifier_agent.py -v
        ;;
    "coverage")
        python -m pytest tests/ --cov=agents --cov-report=term-missing -v
        ;;
    "watch")
        python -m pytest-watch -- tests/ -v
        ;;
    "help")
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac 