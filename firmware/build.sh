#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  ESP32-C3 COB PWM Controller - Automated Build Script   "
echo "=========================================================="

cd "$(dirname "$0")"

# Check if platformio is installed
if ! command -v pio &> /dev/null; then
    echo "PlatformIO not found. Attempting to install via pip..."
    pip install --upgrade platformio esptool
fi

echo "Building ESP32-C3 firmware..."
pio run -e esp32-c3-devkitm-1

echo ""
echo "Build complete! Check the firmware/build_output/ folder for:"
echo " - esp32c3_cob_pwm_merged_factory_0x0.bin  (Flash at 0x0)"
echo " - 0x0000_bootloader.bin                  (Flash at 0x0000)"
echo " - 0x8000_partitions.bin                  (Flash at 0x8000)"
echo " - 0xe000_boot_app0.bin                   (Flash at 0xe000)"
echo " - 0x10000_esp32c3_cob_pwm.bin            (Flash at 0x10000 or use for Web OTA)"
echo "=========================================================="
