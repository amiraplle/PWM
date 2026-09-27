import React from 'react';
import { Wifi, WifiOff, Terminal, FileCode2, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  targetHost: string;
  isPolling: boolean;
  onRefresh: () => void;
  onOpenSerial: () => void;
  onOpenFirmware: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  targetHost,
  isPolling,
  onRefresh,
  onOpenSerial,
  onOpenFirmware,
}) => {
  const isOnline = status === 'connected';

  return (
    <header className="w-full max-w-md mx-auto px-4 py-3 flex items-center justify-between border-b border-gray-900/80 bg-black/60 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              isOnline
                ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
                : status === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-500/80'
            }`}
          />
          {isOnline && (
            <span className="absolute -inset-0.5 rounded-full bg-emerald-500/30 animate-ping" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white">
              COB PWM Controller
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
              ESP32-C3
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono truncate max-w-[190px]">
            {isOnline ? targetHost.replace(/^https?:\/\//, '') : 'Simulated / Reconnecting'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onRefresh}
          disabled={isPolling}
          title="Sync state from ESP32"
          className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        <button
          onClick={onOpenSerial}
          title="USB-C Serial Console"
          className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all"
        >
          <Terminal className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenFirmware}
          title="Firmware Source & Wiring"
          className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all"
        >
          <FileCode2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
