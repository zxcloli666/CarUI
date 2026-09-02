#!/bin/bash

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    CarUI Development                       ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo

mkdir -p data/recordings

if ! lsmod | grep -q gpio_mockup; then
    echo -e "${YELLOW}⚠️  WARNING: gpio-mockup module not loaded${NC}"
    echo "   GPIO simulation will NOT work"
    echo "   Run: sudo ./scripts/setup-dev-gpio.sh"
    echo
fi

if ! lsmod | grep -q v4l2loopback; then
    echo -e "${YELLOW}⚠️  WARNING: v4l2loopback module not loaded${NC}"
    echo "   Camera simulation will NOT work"
    echo "   Run: sudo modprobe v4l2loopback devices=4 video_nr=10,11,12,13 exclusive_caps=0"
    echo
fi

echo -e "${CYAN}[1/3] Building all crates...${NC}"
cargo build --release
echo -e "${GREEN}✓ Build complete${NC}"
echo

pkill -f "carui-" 2>/dev/null || true
pkill -f "mock-arsenal" 2>/dev/null || true
sleep 0.5

echo -e "${CYAN}[2/3] Starting Mock Arsenal...${NC}"
CONFIG_PATH=./config/mock.toml cargo run --bin mock-arsenal &
MOCK_PID=$!
echo -e "${GREEN}✓ Mock Arsenal started (PID: $MOCK_PID)${NC}"
echo
echo -e "  Mock Arsenal UI: ${CYAN}http://localhost:9090${NC}"
echo
sleep 2

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Mock Arsenal is running. Configure it if needed:${NC}"
echo -e "  - Set video source for cameras"
echo -e "  - Check v4l2loopback status"
echo -e "  - Configure GPIO/GPS simulation"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo
echo -e "${GREEN}Press any key to start all services...${NC}"
read -n 1 -s -r
echo

echo -e "${CYAN}[3/3] Starting services...${NC}"

CONFIG_PATH=./config/gpio-dev.toml cargo run --bin carui-gpio --release &
GPIO_PID=$!
echo -e "  ${GREEN}✓${NC} GPIO service (PID: $GPIO_PID)"

CONFIG_PATH=./config/cameras.toml cargo run --bin carui-cameras --release &
CAMERAS_PID=$!
echo -e "  ${GREEN}✓${NC} Cameras service (PID: $CAMERAS_PID)"

sleep 1

CONFIG_PATH=./config/gateway.toml cargo run --bin carui-gateway --release &
GATEWAY_PID=$!
echo -e "  ${GREEN}✓${NC} Gateway (PID: $GATEWAY_PID)"

echo
echo -e "${GREEN}All services started!${NC}"
echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Gateway:       ${CYAN}http://localhost:8080${NC}"
echo -e "  Mock Arsenal:  ${CYAN}http://localhost:9090${NC}"
echo -e "  GPIO:          http://localhost:8084"
echo -e "  Cameras:       http://localhost:8083"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo
echo -e "Press ${RED}Ctrl+C${NC} to stop all services"

cleanup() {
    echo
    echo -e "${YELLOW}Stopping all services...${NC}"
    kill $MOCK_PID $GPIO_PID $CAMERAS_PID $GATEWAY_PID 2>/dev/null || true
    echo -e "${GREEN}Done${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait