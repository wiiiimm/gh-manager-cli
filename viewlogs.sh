#!/bin/bash

# Get the log directory based on platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    LOG_DIR="$HOME/Library/Logs/gh-manager-cli-nodejs"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    LOG_DIR="$HOME/.local/state/gh-manager-cli-nodejs"
else
    LOG_DIR="$APPDATA/gh-manager-cli-nodejs/Logs"
fi

LOG_FILE="$LOG_DIR/gh-manager-cli.log"

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found at: $LOG_FILE"
    echo "The application may not have created any logs yet."
    exit 1
fi

# Show usage
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: ./viewlogs.sh [options]"
    echo ""
    echo "Options:"
    echo "  tail        - Show last 50 lines (default)"
    echo "  follow      - Follow the log in real-time"
    echo "  errors      - Show only ERROR and FATAL messages"
    echo "  full        - Show the entire log file"
    echo "  clear       - Clear the log file"
    echo "  path        - Show the log file path"
    echo ""
    exit 0
fi

# Handle different viewing options
case "$1" in
    follow)
        echo "Following log file: $LOG_FILE"
        echo "Press Ctrl+C to stop"
        echo "----------------------------------------"
        tail -f "$LOG_FILE"
        ;;
    errors)
        echo "Showing ERROR and FATAL messages from: $LOG_FILE"
        echo "----------------------------------------"
        grep -E "\[ERROR\]|\[FATAL\]" "$LOG_FILE" | tail -50
        ;;
    full)
        echo "Full log file: $LOG_FILE"
        echo "----------------------------------------"
        cat "$LOG_FILE"
        ;;
    clear)
        echo "Clearing log file: $LOG_FILE"
        > "$LOG_FILE"
        echo "Log file cleared."
        ;;
    path)
        echo "$LOG_FILE"
        ;;
    tail|*)
        echo "Last 50 lines from: $LOG_FILE"
        echo "----------------------------------------"
        tail -50 "$LOG_FILE"
        ;;
esac