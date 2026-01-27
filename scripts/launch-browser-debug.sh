#!/bin/bash
# Start browser backend for VS Code debugging
# VS Code handles launching Edge via the msedge debug adapter

set -e

BACKEND_PORT="${BACKEND_PORT:-3002}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting browser backend...${NC}"

cd "$(dirname "$0")/.."
pnpm browser start &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend on port $BACKEND_PORT...${NC}"
while ! curl -s "http://localhost:$BACKEND_PORT" > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}Theia app listening on http://0.0.0.0:$BACKEND_PORT${NC}"

# Keep backend running
wait $BACKEND_PID
