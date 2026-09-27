Import("env")
import os
import shutil

def merge_bin_action(source, target, env):
    build_dir = env.subst("$BUILD_DIR")
    firmware_bin = os.path.join(build_dir, "firmware.bin")
    bootloader_bin = os.path.join(build_dir, "bootloader.bin")
    partitions_bin = os.path.join(build_dir, "partitions.bin")
    
    # Packages dir to find boot_app0.bin
    boot_app0 = None
    try:
        platform = env.PioPlatform()
        framework_dir = platform.get_package_dir("framework-arduinoespressif32")
        if framework_dir:
            cand = os.path.join(framework_dir, "tools", "partitions", "boot_app0.bin")
            if os.path.exists(cand):
                boot_app0 = cand
    except Exception as e:
        print(f"[merge_bin] Note: {e}")

    output_dir = os.path.join(env.subst("$PROJECT_DIR"), "build_output")
    os.makedirs(output_dir, exist_ok=True)
    
    # Copy separate binaries with explicit flash address prefixes
    try:
        if os.path.exists(bootloader_bin):
            shutil.copyfile(bootloader_bin, os.path.join(output_dir, "0x0000_bootloader.bin"))
        if os.path.exists(partitions_bin):
            shutil.copyfile(partitions_bin, os.path.join(output_dir, "0x8000_partitions.bin"))
        if boot_app0 and os.path.exists(boot_app0):
            shutil.copyfile(boot_app0, os.path.join(output_dir, "0xe000_boot_app0.bin"))
        if os.path.exists(firmware_bin):
            shutil.copyfile(firmware_bin, os.path.join(output_dir, "0x10000_esp32c3_cob_pwm.bin"))
            shutil.copyfile(firmware_bin, os.path.join(output_dir, "firmware_ota.bin"))
    except Exception as e:
        print(f"[merge_bin] Copy error: {e}")

    # Merged factory binary output path (Flashing offset 0x0)
    merged_bin = os.path.join(output_dir, "esp32c3_cob_pwm_merged_factory_0x0.bin")

    flash_mode = env.get("BOARD_FLASH_MODE", "dio")
    flash_freq = env.get("BOARD_F_FLASH", "80m")
    flash_size = env.get("BOARD_FLASH_SIZE", "4MB")

    cmd = [
        '"$PYTHONEXE"', "-m", "esptool",
        "--chip", "esp32c3",
        "merge_bin",
        "-o", f'"{merged_bin}"',
        "--flash_mode", flash_mode,
        "--flash_freq", flash_freq,
        "--flash_size", flash_size,
        "0x0000", f'"{bootloader_bin}"',
        "0x8000", f'"{partitions_bin}"',
    ]
    if boot_app0 and os.path.exists(boot_app0):
        cmd.extend(["0xe000", f'"{boot_app0}"'])
    cmd.extend(["0x10000", f'"{firmware_bin}"'])

    print("\n========================================================")
    print("  [ESP32-C3] Merging Binaries into Single Factory 0x0   ")
    print("========================================================")
    res = env.Execute(" ".join(cmd))
    if res == 0:
        print(f"\n[SUCCESS] Factory Merged Image: {merged_bin}")
        print(f"[SUCCESS] Separate Images in: {output_dir}\n")

env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", merge_bin_action)
