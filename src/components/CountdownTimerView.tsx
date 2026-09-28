import React, { useState } from 'react';
import { Timer, Play, XCircle, Power, Clock, ShieldCheck, Moon, Sunrise, Sparkles } from 'lucide-react';
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

  const handleStartPreset = (mins: number, action: 'on' | 'off' = targetAction) => {
    onStartTimer(mins * 60, action);
  };

  // Progress calculation for active countdown ring
  const progressPercent =
    timer.active && timer.durationSec > 0
      ? Math.max(0, Math.min(100, ((timer.durationSec - timer.remainingSec) / timer.durationSec) * 100))
      : 0;

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-6">
      {/* Active Timer Status Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col items-center backdrop-blur-md">
        {timer.active ? (
          <div className="flex flex-col items-center w-full gap-4">
            {/* Circular Ring Display with Soft Amber Glow */}
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
                  className="stroke-amber-400 fill-none transition-all duration-1000 ease-linear shadow-[0_0_15px_#f59e0b]"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 78}
                  strokeDashoffset={2 * Math.PI * 78 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                  {formatTime(timer.remainingSec)}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mt-1">
                  Target: {timer.action === 'on' ? 'Turn ON' : 'Turn OFF'}
                </span>
              </div>
            </div>

            <div className="w-full text-center">
              <p className="text-xs text-gray-400">
                Action triggers in {Math.ceil(timer.remainingSec / 60)} minute{Math.ceil(timer.remainingSec / 60) !== 1 ? 's' : ''}
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
            <div className="p-3.5 rounded-full bg-amber-950/40 border border-amber-800/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Clock className="w-8 h-8" />
            </div>

            <div className="text-center">
              <h2 className="text-base font-bold text-white">Hardware Timer & Automation</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Schedule autonomous power events executed directly on the ESP32 hardware
              </p>
            </div>

            {/* Target Action Selector */}
            <div className="w-full grid grid-cols-2 gap-2 p-1 bg-gray-900/90 border border-gray-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setTargetAction('off')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetAction === 'off'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
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
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                Turn ON COB
              </button>
            </div>

            {/* Quick Delay Presets */}
            <div className="w-full">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-2 block">
                Quick Delay Presets ({targetAction.toUpperCase()})
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
                    className="py-2.5 px-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-amber-300 hover:border-amber-500/50 active:scale-95 transition-all cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Duration Input */}
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
                className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-300 active:scale-98 transition-all cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-black" />
                Start Autonomous Timer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Smart Automation Cards */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Smart Lighting Automations</h2>
            <span className="text-[11px] text-gray-500 font-mono">Circadian fade & sleep wind-down</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Bedtime Auto Sleep */}
          <button
            onClick={() => handleStartPreset(30, 'off')}
            disabled={isUpdating}
            className="p-3.5 rounded-2xl bg-gray-900/90 border border-gray-800 text-left hover:border-amber-500/50 hover:bg-gray-900 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:text-amber-300 transition-colors">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-gray-400 font-semibold">30 Min</span>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-200 group-hover:text-amber-300 transition-colors">
                Bedtime Wind-Down
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                Leaves room lit while falling asleep, then shuts off automatically.
              </p>
            </div>
          </button>

          {/* Gentle Morning Wake */}
          <button
            onClick={() => handleStartPreset(15, 'on')}
            disabled={isUpdating}
            className="p-3.5 rounded-2xl bg-gray-900/90 border border-gray-800 text-left hover:border-amber-500/50 hover:bg-gray-900 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:text-amber-300 transition-colors">
                <Sunrise className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-gray-400 font-semibold">15 Min</span>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-200 group-hover:text-amber-300 transition-colors">
                Delayed Morning Wake
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                Triggers COB lamp on after 15 minutes to help wake you up.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Autonomous ESP32 Hardware Guarantee */}
      <div className="w-full p-4 rounded-2xl bg-amber-950/20 border border-amber-800/30 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-amber-300 font-semibold">Hardware-Autonomous Engine: </strong>
          Timers execute on the physical ESP32 processor using non-blocking hardware counters. Closing this web app or powering down your phone will never interrupt the countdown.
        </p>
      </div>
    </div>
  );
};
