import React, { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Layers,
  Cpu,
  GitBranch,
  Terminal,
  Zap,
  FolderArchive,
  ArrowRight,
} from 'lucide-react';

export const FirmwareView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<
    'workflow' | 'flashing' | 'wiring' | 'ino' | 'platformio' | 'merge_bin'
  >('workflow');

  const [sourceCode, setSourceCode] = useState<{
    inoCode: string;
    platformioCode: string;
    workflowCode: string;
    mergeBinCode: string;
    buildShCode: string;
    sizeBytes: number;
  }>({
    inoCode: '',
    platformioCode: '',
    workflowCode: '',
    mergeBinCode: '',
    buildShCode: '',
    sizeBytes: 0,
  });

  useEffect(() => {
    fetch('/api/firmware/source')
      .then((res) => res.json())
      .then((data) => {
        setSourceCode(data);
      })
      .catch(() => {});
  }, []);

  const getCurrentText = () => {
    switch (activeCodeTab) {
      case 'workflow':
        return sourceCode.workflowCode;
      case 'ino':
        return sourceCode.inoCode;
      case 'platformio':
        return sourceCode.platformioCode;
      case 'merge_bin':
        return sourceCode.mergeBinCode;
      default:
        return '';
    }
  };

  const handleCopy = (text?: string) => {
    const textToCopy = text !== undefined ? text : getCurrentText();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5 pb-8">
      {/* Top Banner & Quick Downloads */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">ESP32-C3 Production Build</h2>
              <span className="text-[11px] text-gray-500 font-mono">
                Merged & Separate Bins / GitHub Actions
              </span>
            </div>
          </div>

          {/* Download Action Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href="/api/firmware/download-workflow"
              download="build-esp32.yml"
              title="Download GitHub Actions CI/CD Workflow"
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/80 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 flex items-center gap-1 transition-all"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Workflow .YML
            </a>
            <a
              href="/api/firmware/download-ino"
              download="esp32c3_cob_pwm.ino"
              className="px-2.5 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-semibold hover:text-white flex items-center gap-1 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              .INO
            </a>
            <a
              href="/api/firmware/download-platformio"
              download="platformio.ini"
              className="px-2.5 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-semibold hover:text-white flex items-center gap-1 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              INI
            </a>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-gray-900/90 border border-gray-800 rounded-2xl text-[11px]">
          <button
            onClick={() => setActiveCodeTab('workflow')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'workflow'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            GitHub Actions
          </button>
          <button
            onClick={() => setActiveCodeTab('flashing')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'flashing'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Flashing Guide
          </button>
          <button
            onClick={() => setActiveCodeTab('wiring')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'wiring'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Wiring
          </button>
          <button
            onClick={() => setActiveCodeTab('ino')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'ino'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            .INO Code
          </button>
          <button
            onClick={() => setActiveCodeTab('platformio')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'platformio'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            platformio.ini
          </button>
          <button
            onClick={() => setActiveCodeTab('merge_bin')}
            className={`py-2 px-1 rounded-xl font-semibold transition-all cursor-pointer text-center ${
              activeCodeTab === 'merge_bin'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            merge_bin.py
          </button>
        </div>
      </div>

      {/* 1. GITHUB ACTIONS WORKFLOW VIEW */}
      {activeCodeTab === 'workflow' && (
        <div className="w-full flex flex-col gap-4">
          <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  GitHub Actions CI/CD (.github/workflows/build-esp32.yml)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Direct push to GitHub will automatically compile and produce both Merged (0x0) & Separate bins!
                </p>
              </div>
              <button
                onClick={() => handleCopy(sourceCode.workflowCode)}
                className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy YML
              </button>
            </div>

            {/* Artifacts Summary Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  1. Merged Factory Binary (0x0)
                </span>
                <p className="text-[11px] text-gray-400 mt-1">
                  <code className="text-cyan-400 font-mono">esp32c3_cob_pwm_merged_factory_0x0.bin</code>
                  <br />
                  Single all-in-one file containing bootloader, partitions, boot_app0, and firmware. Flash directly at offset <strong>0x0</strong>.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-gray-900/60 border border-gray-800/80">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                  2. Separate Binaries (Modular)
                </span>
                <p className="text-[11px] text-gray-400 mt-1">
                  - <code>0x0000_bootloader.bin</code>
                  <br />
                  - <code>0x8000_partitions.bin</code>
                  <br />
                  - <code>0xe000_boot_app0.bin</code>
                  <br />
                  - <code>0x10000_esp32c3_cob_pwm.bin</code> (OTA)
                </p>
              </div>
            </div>

            <pre className="p-4 rounded-2xl bg-black border border-gray-900 font-mono text-[11px] leading-relaxed text-gray-300 max-h-[420px] overflow-auto select-all mt-2">
              {sourceCode.workflowCode || 'Loading .github/workflows/build-esp32.yml...'}
            </pre>
          </div>
        </div>
      )}

      {/* 2. FLASHING GUIDE */}
      {activeCodeTab === 'flashing' && (
        <div className="w-full flex flex-col gap-4">
          {/* Method A: Merged Factory Bin */}
          <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Method 1: 1-Click Flash with Merged Factory Binary (Recommended)
              </h3>
              <button
                onClick={() =>
                  handleCopy(
                    'esptool.py --chip esp32c3 --baud 921600 write_flash 0x0 esp32c3_cob_pwm_merged_factory_0x0.bin'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] font-semibold text-gray-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400">
              The merged binary bundles the bootloader, partition table, boot_app0, and application into a single file at address <strong>0x0</strong>.
            </p>
            <div className="p-3 rounded-2xl bg-black border border-gray-900 font-mono text-xs text-cyan-300 overflow-x-auto">
              esptool.py --chip esp32c3 --baud 921600 write_flash 0x0 esp32c3_cob_pwm_merged_factory_0x0.bin
            </div>
          </div>

          {/* Method B: Separate Bins */}
          <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-amber-400" />
                Method 2: Flash with Separate Binaries (Offset Specified)
              </h3>
              <button
                onClick={() =>
                  handleCopy(
                    'esptool.py --chip esp32c3 --baud 921600 write_flash 0x0000 0x0000_bootloader.bin 0x8000 0x8000_partitions.bin 0xe000 0xe000_boot_app0.bin 0x10000 0x10000_esp32c3_cob_pwm.bin'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] font-semibold text-gray-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Use this if flashing through Espressif ESP Flash Download Tool or individual partition flashing.
            </p>
            <div className="p-3 rounded-2xl bg-black border border-gray-900 font-mono text-xs text-amber-300/90 overflow-x-auto leading-relaxed">
{`esptool.py --chip esp32c3 --baud 921600 write_flash \\
  0x0000  0x0000_bootloader.bin \\
  0x8000  0x8000_partitions.bin \\
  0xe000  0xe000_boot_app0.bin \\
  0x10000 0x10000_esp32c3_cob_pwm.bin`}
            </div>
          </div>

          {/* Web OTA Flashing */}
          <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-2 backdrop-blur-md">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Method 3: Over-The-Air (OTA) Web Update (No Cables)
            </h3>
            <p className="text-xs text-gray-400">
              After initial flashing, you never need a USB cable again. Go to <strong>Settings &amp; OTA</strong> tab in this web app, drag and drop <code className="text-cyan-400">0x10000_esp32c3_cob_pwm.bin</code> (or <code className="text-cyan-400">firmware_ota.bin</code>), and click Upload.
            </p>
          </div>
        </div>
      )}

      {/* 3. WIRING SCHEMATIC */}
      {activeCodeTab === 'wiring' && (
        <div className="w-full flex flex-col gap-4">
          <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 backdrop-blur-md">
            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              MOSFET &amp; COB Hardware Schematic
            </h3>

            <div className="p-3.5 rounded-2xl bg-black border border-gray-900 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto whitespace-pre">
{`+-----------------------------------------------------------+
|               ESP32-C3 HARDWARE PWM WIRING                |
+-----------------------------------------------------------+
  +12V / +24V DC PSU -----------------------------+
                                                  |
                                            +-----+------+
                                            |  COB LED   |
                                            +-----+------+
                                                  |
                                              [COB -]
                                                  |
  ESP32-C3 GPIO 4 ---[ 100Ω ]----+-------------- Drain
                                 |            (Logic N-MOSFET)
                              [ 10kΩ ]            |
                                 |              Source
  GND ---------------------------+----------------+
  (Common Ground for ESP32 and 12V/24V Power Supply)`}
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <div>
                  <strong className="text-gray-200">Logic-Level N-MOSFET:</strong>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    ESP32-C3 logic is 3.3V. Use <strong>IRLZ44N</strong>, <strong>AO3400</strong>, <strong>IRLML6344</strong>, or <strong>FQP30N06L</strong>.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <div>
                  <strong className="text-gray-200">10kΩ Pull-down to GND:</strong>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Guarantees gate stays low and COB remains strictly OFF during boot and reset.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CODE VIEW (INO / PLATFORMIO / MERGE_BIN) */}
      {(activeCodeTab === 'ino' || activeCodeTab === 'platformio' || activeCodeTab === 'merge_bin') && (
        <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400">
              {activeCodeTab === 'ino'
                ? 'esp32c3_cob_pwm.ino'
                : activeCodeTab === 'platformio'
                ? 'platformio.ini'
                : 'merge_bin.py'}
            </span>
            <button
              onClick={() => handleCopy()}
              className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Code
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-black border border-gray-900 font-mono text-[11px] leading-relaxed text-gray-300 max-h-[500px] overflow-auto select-all">
            {getCurrentText() || 'Loading file content...'}
          </pre>
        </div>
      )}
    </div>
  );
};
