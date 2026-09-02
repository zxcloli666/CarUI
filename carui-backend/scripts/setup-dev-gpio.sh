#!/bin/bash

set -e

GPIO_SIM_NAME="carui-dev"
GPIO_SIM_CONFIGFS="/sys/kernel/config/gpio-sim/${GPIO_SIM_NAME}"

echo "=== CarUI Dev Environment Setup ==="
echo

cleanup_old() {
    if lsmod | grep -q gpio_mockup; then
        echo "  Unloading old gpio-mockup..."
        rmmod gpio-mockup 2>/dev/null || true
    fi

    if [ -d "$GPIO_SIM_CONFIGFS" ]; then
        echo "  Cleaning up old gpio-sim config..."
        echo 0 > "${GPIO_SIM_CONFIGFS}/live" 2>/dev/null || true
        rmdir "${GPIO_SIM_CONFIGFS}/bank0" 2>/dev/null || true
        rmdir "$GPIO_SIM_CONFIGFS" 2>/dev/null || true
    fi
}

echo "[1/4] Loading gpio-sim kernel module..."
modprobe gpio-sim
echo "  ✓ gpio-sim module loaded"

echo "[2/4] Configuring virtual GPIO chip..."
cleanup_old

mkdir -p "${GPIO_SIM_CONFIGFS}/bank0"

echo 50 > "${GPIO_SIM_CONFIGFS}/bank0/num_lines"
echo "carui" > "${GPIO_SIM_CONFIGFS}/bank0/label"

echo 1 > "${GPIO_SIM_CONFIGFS}/live"
echo "  ✓ gpio-sim configured with 50 virtual lines"

sleep 0.5

CHIP_PATH=$(find /sys/devices/platform -name "gpiochip*" -path "*gpio-sim*" 2>/dev/null | head -1)
if [ -z "$CHIP_PATH" ]; then
    echo "  ✗ Failed to find gpio-sim chip"
    exit 1
fi

CHIP_NAME=$(basename "$CHIP_PATH")
CHIP_DEV="/dev/${CHIP_NAME}"
echo "  ✓ GPIO chip created: ${CHIP_NAME}"

echo "[3/4] Setting up permissions..."
if [ -n "$SUDO_USER" ]; then
    chown root:$SUDO_USER "$CHIP_DEV"
    chmod 660 "$CHIP_DEV"

    chmod -R a+rw "${CHIP_PATH}/sim_gpio"* 2>/dev/null || true
    echo "  ✓ Permissions set for user $SUDO_USER"
fi

echo "[4/4] Verifying setup..."
if ls "${CHIP_PATH}/sim_gpio0/value" &>/dev/null; then
    echo "  ✓ sim_gpio interface available"
else
    echo "  ✗ sim_gpio interface not found at ${CHIP_PATH}/sim_gpio0/value"
    exit 1
fi

echo
echo "=== Setup Complete ==="
echo
echo "GPIO chip: ${CHIP_NAME}"
echo "Device: ${CHIP_DEV}"
echo "Sim GPIO path: ${CHIP_PATH}/sim_gpio<N>/value"
echo
echo "Configure mock-arsenal with:"
echo "  [gpio]"
echo "  chip = \"${CHIP_NAME}\""
echo
echo "Configure carui-gpio with:"
echo "  gpio_chip = \"${CHIP_NAME}\""
echo
echo "Now run: ./scripts/dev.sh"