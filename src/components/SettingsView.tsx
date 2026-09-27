import React, { useState } from 'react';
import {
  Settings,
  Wifi,
  Cpu,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode2,
  Shield,
  Sliders,
  Network,
  Lock,
} from 'lucide-react';
import { ControllerSettings } from '../types';
import { esp32Client } from '../services/esp32Api';

interface SettingsViewProps {
  settings: ControllerSettings;
  targetHost: string;
  useProxy: boolean;
  curveMode?: number;
  onUpdateTargetHost: (host: string) => void;
  onToggleProxy: (useProxy: boolean) => void;
  onUpdateSettings: (newSettings: {
    pwmGpio?: number;
    mdnsHost?: string;
    wifiSsid?: string;
    wifiPass?: string;
    curveMode?: number;
  }) => void;
  onReboot: () => void;
  onOpenFirmware: () => void;
  isUpdating: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  targetHost,
  useProxy,
  curveMode = 0,
  onUpdateTargetHost,
  onToggleProxy,
  onUpdateSettings,
  onReboot,
  onOpenFirmware,
  isUpdating,
}) => {
  // Form inputs
  const [hostInput, setHostInput] = useState(targetHost);
  const [mdnsInput, setMdnsInput] = useState(settings.mdnsHost || 'pwm');
  const [wifiSsidInput, setWifiSsidInput] = useState(settings.wifiSsid || '');
  const [wifiPassInput, setWifiPassInput] = useState('');
  const [gpioInput, setGpioInput] = useState(settings.pwmGpio || 4);
  const [curveInput, setCurveInput] = useState(curveMode);

  // OTA state
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaProgress, setOtaProgress] = useState<number | null>(null);
  const [otaStatus, setOtaStatus] = useState<string>('');
  const [otaError, setOtaError] = useState<string | null>(null);
  const [otaSuccess, setOtaSuccess] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState(false);

  // Success toast
  const [saveToast, setSaveToast] = useState(false);

  const handleSaveNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTargetHost(hostInput);
    onUpdateSettings({
      mdnsHost: mdnsInput,
      wifiSsid: wifiSsidInput,
      ...(wifiPassInput ? { wifiPass: wifiPassInput } : {}),
      pwmGpio: gpioInput,
      curveMode: curveInput,
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOtaError(null);
      setOtaSuccess(false);

      if (!file.name.endsWith('.bin')) {
        setOtaError('Firmware file must have a .bin extension (compiled ESP32 binary).');
        setOtaFile(null);
        return;
      }

      // Check magic byte 0xE9 asynchronously
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (buffer && buffer.byteLength > 0) {
          const view = new Uint8Array(buffer);
          if (view[0] !== 0xe9) {
            setOtaError(
              'Warning: Binary header magic byte is not 0xE9. This may not be a valid ESP32 image.'
            );
          }
        }
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
      setOtaFile(file);
    }
  };

  const handleStartOta = async () => {
    if (!otaFile) return;
    setIsUploading(true);
    setOtaProgress(0);
    setOtaStatus('Uploading firmware binary...');
    setOtaError(null);
    setOtaSuccess(false);

    try {
      const res = await esp32Client.uploadFirmwareOta(otaFile, (percent) => {
        setOtaProgress(percent);
        if (percent === 100) {
          setOtaStatus('Verifying image integrity & flashing to flash partition...');
        }
      });
      setOtaSuccess(true);
      setOtaStatus(res.message || 'Update completed! Device is rebooting into new firmware...');
    } catch (err: any) {
      setOtaError(err.message || 'OTA update failed');
      setOtaStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    return `${hrs}h ${mins}m ${seconds % 60}s`;
  };

  return (
    <div className="w-full flex flex-col items-center gap-5 pb-8">
      {/* Toast Alert */}
      {saveToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-400 text-cyan-200 text-xs font-semibold flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          Settings saved to ESP32 Preferences (NVS)!
        </div>
      )}

      {/* Target Host & Connection Mode */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Device Connection</h2>
            <span className="text-[11px] text-gray-500 font-mono">LAN / mDNS target address</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">ESP32 Address / URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                placeholder="http://pwm.local or http://192.168.1.185"
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => {
                  onUpdateTargetHost(hostInput);
                  setSaveToast(true);
                  setTimeout(() => setSaveToast(false), 2000);
                }}
                className="px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 cursor-pointer"
              >
                Apply
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Accessible via mDNS as <code className="text-cyan-400">http://pwm.local</code> or the device's assigned local IP.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-900">
            <div>
              <span className="text-xs font-medium text-gray-300 block">Backend HTTP Proxy</span>
              <span className="text-[10px] text-gray-500">
                Routes commands via server proxy to prevent browser CORS blocks
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleProxy(!useProxy)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                useProxy ? 'bg-cyan-500' : 'bg-gray-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  useProxy ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Hardware PWM Pin & Network NVS Settings Form */}
      <form
        onSubmit={handleSaveNetwork}
        className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Hardware & NVS Preferences</h2>
            <span className="text-[11px] text-gray-500 font-mono">Saved to non-volatile flash</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">PWM Output GPIO</label>
            <select
              value={gpioInput}
              onChange={(e) => setGpioInput(parseInt(e.target.value, 10))}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value={4}>GPIO 4 (Default)</option>
              <option value={0}>GPIO 0 (Strapping/Boot)</option>
              <option value={1}>GPIO 1 (ADC1_CH1)</option>
              <option value={2}>GPIO 2 (Strapping)</option>
              <option value={3}>GPIO 3 (ADC1_CH3)</option>
              <option value={5}>GPIO 5</option>
              <option value={6}>GPIO 6</option>
              <option value={7}>GPIO 7</option>
              <option value={8}>GPIO 8 (Strapping)</option>
              <option value={9}>GPIO 9 (Boot button)</option>
              <option value={10}>GPIO 10</option>
              <option value={18}>GPIO 18 (USB D-)</option>
              <option value={19}>GPIO 19 (USB D+)</option>
              <option value={20}>GPIO 20 (RX)</option>
              <option value={21}>GPIO 21 (TX)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">mDNS Hostname</label>
            <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl px-2 py-2">
              <input
                type="text"
                value={mdnsInput}
                onChange={(e) => setMdnsInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="pwm"
                className="w-full bg-transparent text-xs font-mono text-cyan-300 focus:outline-none"
              />
              <span className="text-[10px] text-gray-500 font-mono">.local</span>
            </div>
          </div>
        </div>

        {/* Dimming Curve Mode */}
        <div className="pt-2 border-t border-gray-900">
          <label className="text-xs text-gray-400 mb-1.5 flex items-center justify-between">
            <span>Dimming Curve Algorithm</span>
            <span className="text-[10px] text-cyan-400 font-mono">
              {curveInput === 1 ? 'CIE 1931 Eye Curve (Recommended)' : 'Linear 1:1 Direct'}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCurveInput(1)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                curveInput === 1
                  ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-gray-900/80 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold">Eye-Curve (CIE 1931)</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Smooth low-end nightlight. Eliminates sudden jump at 1%.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCurveInput(0)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                curveInput === 0
                  ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-gray-900/80 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold">Linear 1:1 Direct</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Direct electrical duty: 75% = 3071 / 4095.
              </div>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-gray-900">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Wi-Fi SSID</label>
            <input
              type="text"
              value={wifiSsidInput}
              onChange={(e) => setWifiSsidInput(e.target.value)}
              placeholder="Your 2.4GHz Wi-Fi Name"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Wi-Fi Password</label>
            <input
              type="password"
              value={wifiPassInput}
              onChange={(e) => setWifiPassInput(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isUpdating}
          className="w-full mt-2 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/80 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-cyan-500/30 active:scale-98 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
        >
          Save Settings to Preferences / NVS
        </button>
      </form>

      {/* Real OTA Web Firmware Update Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Over-The-Air (OTA) Firmware Update</h2>
            <span className="text-[11px] text-gray-500 font-mono">Real flash updater with validation</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="border-2 border-dashed border-gray-800 rounded-2xl p-4 text-center hover:border-cyan-500/50 transition-colors">
            <input
              type="file"
              accept=".bin"
              id="firmware-file-input"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="firmware-file-input"
              className="flex flex-col items-center cursor-pointer gap-2"
            >
              <UploadCloud className="w-8 h-8 text-gray-500" />
              <span className="text-xs font-semibold text-cyan-400">
                {otaFile ? otaFile.name : 'Select compiled firmware binary (.bin)'}
              </span>
              <span className="text-[10px] text-gray-500">
                {otaFile
                  ? `${(otaFile.size / 1024).toFixed(1)} KB — Ready to upload`
                  : 'Requires firmware binary produced by Arduino IDE or PlatformIO'}
              </span>
            </label>
          </div>

          {otaError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{otaError}</span>
            </div>
          )}

          {otaSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{otaStatus}</span>
            </div>
          )}

          {isUploading && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-400">{otaStatus}</span>
                <span className="text-white font-bold">{otaProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_10px_#06b6d4]"
                  style={{ width: `${otaProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleStartOta}
            disabled={!otaFile || isUploading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-emerald-400 active:scale-98 transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UploadCloud className="w-4 h-4 fill-black" />
            {isUploading ? 'Flashing ESP32 Flash Memory...' : 'Upload & Flash Firmware (OTA)'}
          </button>
        </div>
      </div>

      {/* Device Diagnostics & Status */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Device Telemetry & Specs</h2>
            <span className="text-[11px] text-gray-500 font-mono">ESP32-C3 hardware metrics</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">SoC Architecture</span>
            <span className="text-gray-200 font-semibold">{settings.chip || 'ESP32-C3 RISC-V'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">Wi-Fi RSSI</span>
            <span className="text-emerald-400 font-semibold">{settings.rssi} dBm</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">Free Heap RAM</span>
            <span className="text-cyan-300 font-semibold">
              {(settings.freeHeap / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">Uptime</span>
            <span className="text-gray-200 font-semibold">{formatUptime(settings.uptime)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">IP Address</span>
            <span className="text-gray-200 font-semibold">{settings.ip}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">MAC Address</span>
            <span className="text-gray-200 font-semibold">{settings.mac}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">Wi-Fi Power Saving</span>
            <span className="text-rose-400 font-semibold">Disabled (24/7 Fast)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80">
            <span className="text-[10px] text-gray-500 block">Bluetooth / BLE</span>
            <span className="text-rose-400 font-semibold">Completely Disabled</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-900 flex gap-2">
          <button
            type="button"
            onClick={onOpenFirmware}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            View Firmware / Wiring
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reboot ESP32 controller now? (Settings remain saved in NVS)')) {
                onReboot();
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reboot
          </button>
        </div>
      </div>
    </div>
  );
};
