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
  // Acoustic / operational classification for current PWM frequency
  const getFrequencyLabel = (hz: number) => {
    if (hz < 2000) return 'Audible (Highest MOSFET Efficiency)';
    if (hz < 8000) return 'Standard Carrier (Balanced)';
    if (hz < 18000) return 'Whisper-Quiet (Sub-Audible)';
    return 'Ultrasonic (Zero Camera Flicker)';
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-6">
      {/* COB LED Visual Halo & Power Button */}
      <div className="w-full relative flex flex-col items-center justify-center pt-2 pb-1">
        {/* Ambient Warm Photon Glow */}
        <div
          className="absolute w-56 h-56 rounded-full pointer-events-none transition-all duration-700 blur-3xl"
          style={{
            background: state.power
              ? `radial-gradient(circle, rgba(245,158,11,${0.18 + (state.brightness / 100) * 0.45}) 0%, rgba(245,158,11,0) 70%)`
              : 'none',
          }}
        />

        {/* Central Power Button - Warm Tuya Illumination */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={onTogglePower}
            disabled={isUpdating}
            aria-label="Toggle Power"
            className={`group relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 outline-none select-none cursor-pointer active:scale-95 ${
              state.power
                ? 'bg-gradient-to-b from-amber-950/70 via-gray-950 to-black border-4 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.4),inset_0_0_25px_rgba(245,158,11,0.25)]'
                : 'bg-gradient-to-b from-gray-900 to-gray-950 border-4 border-gray-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:border-gray-700'
            }`}
          >
            <Power
              className={`w-14 h-14 transition-all duration-300 stroke-[2.2] ${
                state.power
                  ? 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                  : 'text-gray-500 group-hover:text-gray-400'
              }`}
            />
            <span
              className={`text-[11px] font-bold tracking-widest uppercase mt-1 transition-colors ${
                state.power ? 'text-amber-300' : 'text-gray-500'
              }`}
            >
              {state.power ? 'ON' : 'OFF'}
            </span>

            {/* Glowing ring animation when powered */}
            {state.power && (
              <span className="absolute -inset-1.5 rounded-full border border-amber-400/40 animate-pulse pointer-events-none" />
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
            <span className="text-2xl font-bold font-mono text-amber-300">
              {state.brightness}
            </span>
            <span className="text-xs font-bold text-amber-400/80">%</span>
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
                    ? 'bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {preset}%
              </button>
            );
          })}
        </div>
      </div>

      {/* PWM Frequency Card with Responsive Slider */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">PWM Frequency</h2>
              <span className="text-[10px] text-amber-400/90 font-mono block">
                {getFrequencyLabel(state.frequency)}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold font-mono text-amber-300">
              {state.frequency.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-amber-400/80">Hz</span>
          </div>
        </div>

        {/* Continuous Slider for Frequency (500 Hz to 25,000 Hz) */}
        <div className="px-1 pt-1">
          <input
            type="range"
            min={500}
            max={25000}
            step={500}
            value={state.frequency}
            onChange={(e) => onFrequencyChange(parseInt(e.target.value, 10))}
            className="w-full"
            aria-label="PWM Frequency Slider"
          />
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
          <span>500 Hz</span>
          <span>5 kHz</span>
          <span>10 kHz</span>
          <span>20 kHz</span>
          <span>25 kHz</span>
        </div>

        {/* Quick Frequency Presets */}
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
                    ? 'bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Softness / Non-Blocking Fade Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Softness (Fade Time)</h2>
              <span className="text-[10px] text-gray-500 font-mono block">Non-blocking cosine ease</span>
            </div>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold font-mono text-amber-300">
              {state.softness}
            </span>
            <span className="text-xs font-bold text-amber-400/80">ms</span>
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
                    ? 'bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
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
