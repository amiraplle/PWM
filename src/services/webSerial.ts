// Web Serial API service for live hardware terminal & debugging over USB-C
export class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private isConnected: boolean = false;
  private logCallbacks: ((log: string) => void)[] = [];

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public onLog(callback: (log: string) => void) {
    this.logCallbacks.push(callback);
    return () => {
      this.logCallbacks = this.logCallbacks.filter(cb => cb !== callback);
    };
  }

  private emitLog(text: string) {
    for (const cb of this.logCallbacks) {
      cb(text);
    }
  }

  public async connect(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera.');
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.isConnected = true;
      this.emitLog('\n--- Connected to ESP32-C3 Serial Port (115200 baud) ---\n');
      this.startReading();
    } catch (err: any) {
      this.isConnected = false;
      throw err;
    }
  }

  private async startReading() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.emitLog(value);
        }
      }
    } catch (error) {
      this.emitLog(`\n[Serial Error: ${error}]\n`);
    } finally {
      this.reader.releaseLock();
      await readableStreamClosed.catch(() => {});
    }
  }

  public async send(command: string): Promise<void> {
    if (!this.port || !this.port.writable) {
      throw new Error('Serial port is not connected');
    }
    const encoder = new TextEncoder();
    const writer = this.port.writable.getWriter();
    await writer.write(encoder.encode(command + '\n'));
    writer.releaseLock();
  }

  public async disconnect(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    this.isConnected = false;
    this.emitLog('\n--- Serial Port Disconnected ---\n');
  }
}

export const webSerial = new WebSerialService();
