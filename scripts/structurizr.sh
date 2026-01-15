#!/usr/bin/env bash
# structurizr.sh - Launch Structurizr Lite for the .C4 workspace
# Usage: ./scripts/structurizr.sh [--rebuild] [--port PORT]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
C4_DIR="$ROOT_DIR/.C4"
DOCKER_IMAGE="structurizr/lite"
CONTAINER_NAME="sanyam-structurizr"
PORT=8080
REBUILD=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--rebuild] [--port PORT]"
            echo ""
            echo "Options:"
            echo "  --rebuild    Regenerate workspace.dsl before launching"
            echo "  --port PORT  Use specified port (default: 8080)"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Sanyam Platform - Structurizr C4 Diagram Viewer${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}Docker daemon is not running. Attempting to start...${NC}"
    
    # Try to start Docker (platform-specific)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>/dev/null || true
    else
        echo -e "${RED}Please start Docker manually and try again${NC}"
        exit 1
    fi
    
    # Wait for Docker to start
    echo -n "Waiting for Docker"
    for i in {1..30}; do
        if docker info &> /dev/null; then
            echo ""
            echo -e "${GREEN}Docker is ready${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    if ! docker info &> /dev/null; then
        echo ""
        echo -e "${RED}Docker failed to start in time${NC}"
        exit 1
    fi
fi

# Ensure .C4 directory exists
if [ ! -d "$C4_DIR" ]; then
    echo -e "${YELLOW}Creating .C4 directory...${NC}"
    mkdir -p "$C4_DIR"
fi

# Check workspace.dsl exists
if [ ! -f "$C4_DIR/workspace.dsl" ]; then
    echo -e "${RED}Error: workspace.dsl not found in $C4_DIR${NC}"
    echo -e "${YELLOW}Run '/structurizr' in Claude Code to generate it first${NC}"
    exit 1
fi

echo -e "${GREEN}Workspace: ${NC}$C4_DIR/workspace.dsl"
echo ""

# Stop existing container if running
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
    sleep 1
fi

# Remove old container if exists
docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true

# Pull image if not present
if ! docker images -q "$DOCKER_IMAGE" | grep -q .; then
    echo -e "${YELLOW}Pulling Structurizr Lite image (first time only)...${NC}"
    docker pull "$DOCKER_IMAGE"
fi

# Start container
echo -e "${YELLOW}Starting Structurizr Lite on port $PORT...${NC}"
docker run -d \
    --rm \
    --name "$CONTAINER_NAME" \
    -p "${PORT}:8080" \
    -v "$C4_DIR:/usr/local/structurizr" \
    "$DOCKER_IMAGE" > /dev/null

# Wait for service to be ready
echo -n "Waiting for Structurizr"
for i in {1..20}; do
    if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
        echo ""
        break
    fi
    echo -n "."
    sleep 1
done

# Check if ready
if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    URL="http://localhost:$PORT"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Structurizr is running at: $URL${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Open browser (platform-specific)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$URL"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        start "$URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$URL"
    else
        echo -e "${YELLOW}Open your browser to: $URL${NC}"
    fi
    
    echo -e "${YELLOW}Press Ctrl+C to stop the container${NC}"
    echo ""
    
    # Follow logs until interrupted
    docker logs -f "$CONTAINER_NAME"
else
    echo ""
    echo -e "${RED}Structurizr failed to start. Check Docker logs:${NC}"
    docker logs "$CONTAINER_NAME"
    exit 1
fi