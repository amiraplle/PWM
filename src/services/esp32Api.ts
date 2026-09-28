import { ControllerState } from '../types';

export const DEFAULT_ESP32_HOST = 'http://pwm.local';

// Default initial state representing uninitialized state before ESP32 responds
export const INITIAL_STATE: ControllerState = {
  power: false,
  brightness: 75,
  softness: 400,
  frequency: 5000,
  curveMode: 0,
  timer: {
    active: false,
    durationSec: 0,
    remainingSec: 0,
    action: 'off'
  },
  settings: {
    mdnsHost: 'pwm',
    wifiSsid: '',
    pwmGpio: 4,
    uptime: 0,
    freeHeap: 0,
    rssi: 0,
    ip: '',
    mac: '',
    chip: 'ESP32-C3',
    compileDate: ''
  }
};

class Esp32Client {
  private targetHost: string = DEFAULT_ESP32_HOST;
  private useProxy: boolean = false;

  constructor() {
    const savedHost = localStorage.getItem('esp32_target_host');
    if (savedHost) this.targetHost = savedHost;
    const savedProxy = localStorage.getItem('esp32_use_proxy');
    if (savedProxy !== null) this.useProxy = savedProxy === 'true';
  }

  public getTargetHost(): string {
    return this.targetHost;
  }

  public setTargetHost(host: string) {
    let cleanHost = host.trim();
    if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
      cleanHost = 'http://' + cleanHost;
    }
    // Remove trailing slash
    cleanHost = cleanHost.replace(/\/+$/, '');
    this.targetHost = cleanHost;
    localStorage.setItem('esp32_target_host', this.targetHost);
  }

  public getUseProxy(): boolean {
    return this.useProxy;
  }

  public setUseProxy(val: boolean) {
    this.useProxy = val;
    localStorage.setItem('esp32_use_proxy', String(val));
  }

  private buildUrl(path: string): string {
    const espUrl = `${this.targetHost}${path}`;
    if (this.useProxy) {
      return `/api/esp32/proxy?target=${encodeURIComponent(espUrl)}`;
    }
    return espUrl;
  }

  public async fetchState(): Promise<ControllerState> {
    const url = this.buildUrl('/api/state');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    return await res.json();
  }

  public async setPower(power: boolean): Promise<ControllerState> {
    const url = this.buildUrl('/api/power');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ power })
    });
    if (!res.ok) throw new Error('Failed to set power state');
    return await res.json();
  }

  public async setBrightness(brightness: number): Promise<ControllerState> {
    const clamped = Math.max(1, Math.min(100, Math.round(brightness)));
    const url = this.buildUrl('/api/brightness');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brightness: clamped })
    });
    if (!res.ok) throw new Error('Failed to set brightness');
    return await res.json();
  }

  public async setSoftness(softness: number): Promise<ControllerState> {
    const clamped = Math.max(0, Math.min(3000, Math.round(softness)));
    const url = this.buildUrl('/api/softness');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ softness: clamped })
    });
    if (!res.ok) throw new Error('Failed to set softness');
    return await res.json();
  }

  public async setFrequency(frequency: number): Promise<ControllerState> {
    const clamped = Math.max(500, Math.min(25000, Math.round(frequency)));
    const url = this.buildUrl('/api/frequency');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency: clamped })
    });
    if (!res.ok) throw new Error('Failed to set frequency');
    return await res.json();
  }

  public async startTimer(durationSec: number, action: 'on' | 'off'): Promise<ControllerState> {
    const url = this.buildUrl('/api/timer');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSec, action })
    });
    if (!res.ok) throw new Error('Failed to start timer');
    return await res.json();
  }

  public async cancelTimer(): Promise<ControllerState> {
    const url = this.buildUrl('/api/timer');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel: true })
    });
    if (!res.ok) throw new Error('Failed to cancel timer');
    return await res.json();
  }

  public async updateSettings(settings: {
    pwmGpio?: number;
    mdnsHost?: string;
    wifiSsid?: string;
    wifiPass?: string;
    curveMode?: number;
  }): Promise<ControllerState> {
    const url = this.buildUrl('/api/settings');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return await res.json();
  }

  public async rebootDevice(): Promise<{ success: boolean; message: string }> {
    const url = this.buildUrl('/api/reboot');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to send reboot command');
    return await res.json();
  }

  /**
   * Upload binary firmware via real OTA endpoint with progress tracking
   */
  public uploadFirmwareOta(
    file: File,
    onProgress: (percent: number, loaded: number, total: number) => void
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const targetEndpoint = `${this.targetHost}/update`;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = JSON.parse(xhr.responseText);
            resolve(resp);
          } catch {
            resolve({ success: true, message: 'Firmware uploaded successfully! Rebooting...' });
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `OTA update failed with code ${xhr.status}`));
          } catch {
            reject(new Error(`OTA update failed with HTTP status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during OTA upload. Check ESP32 connection.'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('OTA upload was aborted.'));
      });

      xhr.open('POST', targetEndpoint, true);
      const formData = new FormData();
      formData.append('update', file, file.name);
      xhr.send(formData);
    });
  }
}

export const esp32Client = new Esp32Client();
