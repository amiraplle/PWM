import React from 'react';
import { Sun, Timer, Settings, Cpu } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  isTimerActive: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  isTimerActive,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/85 backdrop-blur-xl border-t border-gray-900/90 max-w-md mx-auto px-4 py-2">
      <div className="flex items-center justify-around">
        <button
          onClick={() => onChangeTab('controller')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            currentTab === 'controller'
              ? 'text-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'controller'
                ? 'bg-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <Sun className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">COB Light</span>
        </button>

        <button
          onClick={() => onChangeTab('timer')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl relative transition-all duration-200 cursor-pointer ${
            currentTab === 'timer'
              ? 'text-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              currentTab === 'timer'
                ? 'bg-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <Timer className="w-5 h-5" />
            {isTimerActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-ping" />
            )}
          </div>
          <span className="text-[11px] font-bold tracking-tight">Timer</span>
        </button>

        <button
          onClick={() => onChangeTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            currentTab === 'settings'
              ? 'text-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'settings'
                ? 'bg-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <Settings className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Settings & OTA</span>
        </button>

        <button
          onClick={() => onChangeTab('firmware')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            currentTab === 'firmware'
              ? 'text-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'firmware'
                ? 'bg-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Firmware</span>
        </button>
      </div>
    </nav>
  );
};
