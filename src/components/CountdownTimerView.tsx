import React, { useState } from 'react';
import { Timer, Play, XCircle, Power, Clock, ShieldCheck } from 'lucide-react';
import { CountdownTimerState } from '../types';

interface CountdownTimerViewProps {
  timer: CountdownTimerState;
  onStartTimer: (durationSec: number, action: 'on' | 'off') => void;
  onCancelTimer: () => void;
  isUpdating: boolean;
}

export const CountdownTimerView: React.FC<CountdownTimerViewProps> = ({
  timer,
  onStartTimer,
  onCancelTimer,
  isUpdating,
}) => {
  const [targetAction, setTargetAction] = useState<'on' | 'off'>(timer.action || 'off');
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [customSeconds, setCustomSeconds] = useState(0);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const handleStartCustom = () => {
    const totalSec = customHours * 3600 + customMinutes * 60 + customSeconds;
    if (totalSec > 0) {
      onStartTimer(totalSec, targetAction);
    }
  };

  const handleStartPreset = (mins: number) => {
    onStartTimer(mins * 60, targetAction);
  };

  // Progress for active timer ring
  const progressPercent =
    timer.active && timer.durationSec > 0
      ? Math.max(0, Math.min(100, ((timer.durationSec - timer.remainingSec) / timer.durationSec) * 100))
      : 0;

  return (
    <div className="w-full flex flex-col items-center gap-5 pb-6">
      {/* Timer Status Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col items-center backdrop-blur-md">
        {timer.active ? (
          <div className="flex flex-col items-center w-full gap-4">
            {/* Circular Ring Display */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  className="stroke-gray-900 fill-none"
                  strokeWidth="8"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  className="stroke-cyan-400 fill-none transition-all duration-1000 ease-linear shadow-[0_0_15px_#06b6d4]"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 78}
                  strokeDashoffset={2 * Math.PI * 78 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  {formatTime(timer.remainingSec)}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mt-1">
                  Target: {timer.action === 'on' ? 'Turn ON' : 'Turn OFF'}
                </span>
              </div>
            </div>

            <div className="w-full text-center">
              <p className="text-xs text-gray-400">
                Trigger action in {Math.ceil(timer.remainingSec / 60)} minute{Math.ceil(timer.remainingSec / 60) !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Cancel Button */}
            <button
              onClick={onCancelTimer}
              disabled={isUpdating}
              className="w-full py-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-900/50 active:scale-98 transition-all cursor-pointer shadow-[0_0_20px_rgba(244,63,94,0.15)]"
            >
              <XCircle className="w-4 h-4" />
              Cancel Active Timer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full gap-5">
            <div className="p-3.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Clock className="w-8 h-8" />
            </div>

            <div className="text-center">
              <h2 className="text-base font-bold text-white">ESP32 Hardware Timer</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Set a delay to automatically turn the COB LED ON or OFF
              </p>
            </div>

            {/* Target Action Selector */}
            <div className="w-full grid grid-cols-2 gap-2 p-1 bg-gray-900/90 border border-gray-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setTargetAction('off')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetAction === 'off'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                Turn OFF COB
              </button>
              <button
                type="button"
                onClick={() => setTargetAction('on')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetAction === 'on'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                Turn ON COB
              </button>
            </div>

            {/* Quick Presets */}
            <div className="w-full">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-2 block">
                Quick Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '5 Min', mins: 5 },
                  { label: '15 Min', mins: 15 },
                  { label: '30 Min', mins: 30 },
                  { label: '45 Min', mins: 45 },
                  { label: '1 Hour', mins: 60 },
                  { label: '2 Hours', mins: 120 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    onClick={() => handleStartPreset(item.mins)}
                    disabled={isUpdating}
                    className="py-2.5 px-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-cyan-300 hover:border-cyan-500/50 active:scale-95 transition-all cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Duration Selector */}
            <div className="w-full pt-1 border-t border-gray-900">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-2 block">
                Custom Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center bg-gray-900/80 border border-gray-800 rounded-xl p-2">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Hours</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={customHours}
                    onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-center bg-transparent text-lg font-bold font-mono text-white outline-none"
                  />
                </div>
                <div className="flex flex-col items-center bg-gray-900/80 border border-gray-800 rounded-xl p-2">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Minutes</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full text-center bg-transparent text-lg font-bold font-mono text-white outline-none"
                  />
                </div>
                <div className="flex flex-col items-center bg-gray-900/80 border border-gray-800 rounded-xl p-2">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={customSeconds}
                    onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full text-center bg-transparent text-lg font-bold font-mono text-white outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleStartCustom}
                disabled={isUpdating || (customHours === 0 && customMinutes === 0 && customSeconds === 0)}
                className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:from-cyan-500 hover:to-cyan-400 active:scale-98 transition-all cursor-pointer shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-black" />
                Start Countdown Timer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hardware Independence Note */}
      <div className="w-full p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 flex items-start gap-3 text-xs text-cyan-200/90 leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-cyan-300 font-semibold">Native ESP32 Execution: </strong>
          The countdown timer operates autonomously in the ESP32 hardware main loop. Even if you close this web browser, sleep your phone, or disconnect Wi-Fi, the ESP32 will accurately trigger at the scheduled moment.
        </p>
      </div>
    </div>
  );
};
