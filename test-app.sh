#!/bin/bash
node dist/index.js &
PID=$!
sleep 3
kill $PID 2>/dev/null