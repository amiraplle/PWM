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
              ? 'text-amber-300'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'controller'
                ? 'bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
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
              ? 'text-amber-300'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              currentTab === 'timer'
                ? 'bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : ''
            }`}
          >
            <Timer className="w-5 h-5" />
            {isTimerActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping" />
            )}
          </div>
          <span className="text-[11px] font-bold tracking-tight">Timer & Auto</span>
        </button>

        <button
          onClick={() => onChangeTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            currentTab === 'settings'
              ? 'text-amber-300'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'settings'
                ? 'bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
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
              ? 'text-amber-300'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              currentTab === 'firmware'
                ? 'bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
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
