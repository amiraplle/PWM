import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Play, Power, Trash2, AlertCircle } from 'lucide-react';
import { webSerial } from '../services/webSerial';

interface SerialConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SerialConsoleModal: React.FC<SerialConsoleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [inputCmd, setInputCmd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isSupported = webSerial.isSupported();

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = webSerial.onLog((text) => {
      setLogs((prev) => [...prev, text]);
    });

    setIsConnected(webSerial.getIsConnected());

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setError(null);
    try {
      await webSerial.connect();
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to serial port');
    }
  };

  const handleDisconnect = async () => {
    await webSerial.disconnect();
    setIsConnected(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim()) return;
    try {
      await webSerial.send(inputCmd);
      setLogs((prev) => [...prev, `\n> ${inputCmd}\n`]);
      setInputCmd('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-gray-950 border border-gray-800 rounded-3xl p-5 flex flex-col gap-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-900 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">ESP32-C3 USB-C Serial Monitor</h2>
              <span className="text-[11px] text-gray-400 font-mono">115200 Baud / Direct Hardware</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold hover:bg-rose-900/60 cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!isSupported}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 cursor-pointer disabled:opacity-40"
              >
                Connect ESP32
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isSupported && (
          <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera.</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Log Viewer */}
        <div
          ref={logContainerRef}
          className="w-full h-72 bg-black border border-gray-900 rounded-2xl p-3 font-mono text-xs text-gray-300 overflow-y-auto whitespace-pre-wrap select-all"
        >
          {logs.length === 0 ? (
            <span className="text-gray-600">
              {isConnected
                ? 'Connected. Waiting for serial data from ESP32...'
                : 'Connect your ESP32-C3 via USB-C and click "Connect ESP32" above to view live boot logs, Wi-Fi logs, and hardware PWM events.'}
            </span>
          ) : (
            logs.join('')
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-1">
          <form onSubmit={handleSend} className="flex-1 flex gap-2">
            <input
              type="text"
              value={inputCmd}
              onChange={(e) => setInputCmd(e.target.value)}
              placeholder="Send command to ESP32 serial..."
              disabled={!isConnected}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isConnected || !inputCmd.trim()}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-40 cursor-pointer"
            >
              Send
            </button>
          </form>

          <button
            onClick={handleClear}
            title="Clear logs"
            className="ml-2 p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
