import React from 'react';
import { Power, Sun, Wind, Activity } from 'lucide-react';
import { ControllerState } from '../types';

interface MainControllerProps {
  state: ControllerState;
  onTogglePower: () => void;
  onBrightnessChange: (val: number) => void;
  onSoftnessChange: (val: number) => void;
  onFrequencyChange: (val: number) => void;
  onCurveChange?: (val: number) => void;
  isUpdating: boolean;
}

export const MainController: React.FC<MainControllerProps> = ({
  state,
  onTogglePower,
  onBrightnessChange,
  onSoftnessChange,
  onFrequencyChange,
  isUpdating,
}) => {
  return (
    <div className="w-full flex flex-col items-center gap-5 pb-6">
      {/* COB LED Visual Halo & Power Button */}
      <div className="w-full relative flex flex-col items-center justify-center pt-2 pb-2">
        {/* Ambient Glow */}
        <div
          className="absolute w-48 h-48 rounded-full pointer-events-none transition-all duration-500 blur-3xl"
          style={{
            background: state.power
              ? `radial-gradient(circle, rgba(6,182,212,${0.15 + (state.brightness / 100) * 0.45}) 0%, rgba(6,182,212,0) 70%)`
              : 'none',
          }}
        />

        {/* Central Power Button - Clean Tuya Style */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={onTogglePower}
            disabled={isUpdating}
            aria-label="Toggle Power"
            className={`group relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 outline-none select-none cursor-pointer active:scale-95 ${
              state.power
                ? 'bg-gradient-to-b from-cyan-900/60 to-cyan-950/80 border-4 border-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.45),inset_0_0_25px_rgba(6,182,212,0.3)]'
                : 'bg-gradient-to-b from-gray-900 to-gray-950 border-4 border-gray-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:border-gray-700'
            }`}
          >
            <Power
              className={`w-14 h-14 transition-all duration-300 stroke-[2.2] ${
                state.power
                  ? 'text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                  : 'text-gray-500 group-hover:text-gray-400'
              }`}
            />
            <span
              className={`text-[11px] font-bold tracking-widest uppercase mt-1 transition-colors ${
                state.power ? 'text-cyan-300' : 'text-gray-500'
              }`}
            >
              {state.power ? 'ON' : 'OFF'}
            </span>

            {/* Glowing ring animation when powered */}
            {state.power && (
              <span className="absolute -inset-1.5 rounded-full border border-cyan-400/30 animate-pulse pointer-events-none" />
            )}
          </button>
        </div>
      </div>

      {/* Brightness Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sun className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-gray-200">Brightness</h2>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {state.brightness}
            </span>
            <span className="text-xs font-bold text-cyan-500/80">%</span>
          </div>
        </div>

        {/* Range Slider (Strictly 1 to 100) */}
        <div className="px-1 pt-1">
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={state.brightness}
            onChange={(e) => onBrightnessChange(parseInt(e.target.value, 10))}
            className="w-full"
            aria-label="Brightness Slider"
          />
        </div>

        {/* Brightness Presets */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {[1, 25, 50, 75, 100].map((preset) => {
            const isSelected = state.brightness === preset;
            return (
              <button
                key={preset}
                onClick={() => onBrightnessChange(preset)}
                className={`py-2 rounded-xl text-xs font-semibold font-mono transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {preset}%
              </button>
            );
          })}
        </div>
      </div>

      {/* Softness / Non-Blocking Fade Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Wind className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-gray-200">Softness</h2>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {state.softness}
            </span>
            <span className="text-xs font-bold text-cyan-500/80">ms</span>
          </div>
        </div>

        {/* Range Slider for Softness */}
        <div className="px-1 pt-1">
          <input
            type="range"
            min={0}
            max={3000}
            step={50}
            value={state.softness}
            onChange={(e) => onSoftnessChange(parseInt(e.target.value, 10))}
            className="w-full"
            aria-label="Softness Slider"
          />
        </div>

        {/* Presets */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {[
            { label: '0ms', val: 0 },
            { label: '200ms', val: 200 },
            { label: '400ms', val: 400 },
            { label: '1000ms', val: 1000 },
            { label: '2000ms', val: 2000 },
          ].map((item) => {
            const isSelected = state.softness === item.val;
            return (
              <button
                key={item.val}
                onClick={() => onSoftnessChange(item.val)}
                className={`py-2 rounded-xl text-xs font-semibold font-mono transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware PWM Frequency Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-gray-200">Frequency</h2>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {state.frequency.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-cyan-500/80">Hz</span>
          </div>
        </div>

        {/* Range Slider for Frequency */}
        <div className="px-1 pt-1">
          <input
            type="range"
            min={500}
            max={25000}
            step={500}
            value={state.frequency}
            onChange={(e) => onFrequencyChange(parseInt(e.target.value, 10))}
            className="w-full"
            aria-label="Frequency Slider"
          />
        </div>

        {/* Frequency Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { label: '1 kHz', val: 1000 },
            { label: '5 kHz', val: 5000 },
            { label: '10 kHz', val: 10000 },
            { label: '20 kHz', val: 20000 },
          ].map((item) => {
            const isSelected = state.frequency === item.val;
            return (
              <button
                key={item.val}
                onClick={() => onFrequencyChange(item.val)}
                className={`py-2 rounded-xl text-xs font-semibold font-mono transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
