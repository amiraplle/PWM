import React, { useRef } from 'react';
import { Power, Sun, Wind, Activity, Zap, CheckCircle2 } from 'lucide-react';
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
  onCurveChange,
  isUpdating,
}) => {
  const [showCurveInfo, setShowCurveInfo] = React.useState(false);
  const isEyeCurve = (state.curveMode ?? 0) === 1;

  // Real 12-bit Hardware PWM Duty Calculation (0 to 4095)
  const calculatePhysicalDuty = (percent: number, mode: number) => {
    const clamped = Math.max(1, Math.min(100, percent));
    if (mode === 1) {
      // CIE 1931 Standard Perceptual Lightness Formula (Industry standard for LED dimming)
      // Eliminates low-end jumpiness: 1% gives subtle moonlight, not blinding light
      const L = clamped;
      let Y: number;
      if (L > 8) {
        Y = Math.pow((L + 16) / 116, 3);
      } else {
        Y = L / 903.3;
      }
      return Math.max(1, Math.min(4095, Math.round(Y * 4095)));
    } else {
      // Pure Linear 1:1 Electrical Duty (75% = 3071 / 4095)
      return Math.max(1, Math.min(4095, Math.round((clamped * 4095) / 100)));
    }
  };

  const physicalDuty = state.power
    ? calculatePhysicalDuty(state.brightness, state.curveMode ?? 0)
    : 0;

  return (
    <div className="w-full flex flex-col items-center gap-5 pb-6">
      {/* COB LED Visual Halo & Physical Output Status */}
      <div className="w-full relative flex flex-col items-center justify-center pt-2 pb-4">
        {/* Ambient Glow */}
        <div
          className="absolute w-48 h-48 rounded-full pointer-events-none transition-all duration-500 blur-3xl"
          style={{
            background: state.power
              ? `radial-gradient(circle, rgba(6,182,212,${0.15 + (state.brightness / 100) * 0.45}) 0%, rgba(6,182,212,0) 70%)`
              : 'none',
          }}
        />

        {/* Central Power Button - Tuya Style */}
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

          {/* Hardware Output Feedback pill & Curve Mode Switcher */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-900/90 border border-gray-800 text-[11px] font-mono shadow-md">
              <span
                className={`w-2 h-2 rounded-full ${
                  state.power ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' : 'bg-gray-600'
                }`}
              />
              <span className="text-gray-400">PWM Output:</span>
              <span className={state.power ? 'text-cyan-300 font-bold' : 'text-gray-500'}>
                {state.power ? `${state.brightness}% (${physicalDuty} / 4095)` : '0% (Physical OFF)'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 uppercase font-sans font-semibold">
                {isEyeCurve ? 'CIE 1931 Eye Curve' : 'Linear 1:1'}
              </span>
            </div>

            {/* Quick Curve Selector */}
            {onCurveChange && (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-950/80 border border-gray-800/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => onCurveChange(1)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    isEyeCurve
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Eye-Corrected (CIE 1931)
                </button>
                <button
                  type="button"
                  onClick={() => onCurveChange(0)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    !isEyeCurve
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Linear (1:1 Direct)
                </button>
                <button
                  type="button"
                  onClick={() => setShowCurveInfo(!showCurveInfo)}
                  className="px-1.5 py-1 text-gray-500 hover:text-cyan-400 font-bold cursor-pointer"
                  title="Why Eye-Correction is useful"
                >
                  ⓘ
                </button>
              </div>
            )}

            {/* Expandable Explanation for Single-Color White COB */}
            {showCurveInfo && (
              <div className="w-full max-w-sm mt-1 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-gray-300 flex flex-col gap-2">
                <div className="font-bold text-cyan-300 flex items-center justify-between">
                  <span>Why Eye-Correction (CIE 1931 / Gamma) is Essential:</span>
                  <button
                    onClick={() => setShowCurveInfo(false)}
                    className="text-gray-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Your eyes don't see light linearly—they are 10× more sensitive in the dark. Without correction, <strong>10% electrical power looks ~40% bright</strong>, and 1% is too harsh to sleep with. CIE 1931 shapes the power so 1% is a gentle moonlight glow, and dimming is silky smooth.
                </p>
                <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono border-t border-cyan-900/60">
                  <span className="text-gray-400">Target</span>
                  <span className="text-cyan-400">Eye-Curve</span>
                  <span className="text-gray-400">Linear 1:1</span>
                  <span>1% (Night)</span>
                  <span className="text-cyan-300">5 / 4095</span>
                  <span>41 / 4095</span>
                  <span>50% (Room)</span>
                  <span className="text-cyan-300">753 / 4095</span>
                  <span>2048 / 4095</span>
                  <span>75% (Task)</span>
                  <span className="text-cyan-300">1977 / 4095</span>
                  <span>3071 / 4095</span>
                  <span>100% (Max)</span>
                  <span className="text-cyan-300">4095 / 4095</span>
                  <span>4095 / 4095</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Brightness Card (Strict 1–100%) */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Brightness</h2>
              <span className="text-[11px] text-gray-500 font-mono">Range 1% – 100%</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {state.brightness}
            </span>
            <span className="text-xs font-bold text-cyan-500/80">%</span>
          </div>
        </div>

        {/* Range Slider - Strictly 1 to 100 */}
        <div className="px-1 pt-1">
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={state.brightness}
            onChange={(e) => onBrightnessChange(parseInt(e.target.value, 10))}
            className="w-full"
            aria-label="COB Brightness Slider"
          />
        </div>

        {/* Informational Status when OFF */}
        {!state.power && (
          <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center gap-2 text-[11px] text-cyan-300">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>
              Adjustable while OFF. Saved to NVS and restored on ON without lighting the COB.
            </span>
          </div>
        )}

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

        {/* Real Hardware Duty Indicator */}
        <div className="pt-1.5 px-1 flex items-center justify-between text-[10px] text-gray-500 font-mono border-t border-gray-900 mt-1">
          <span>{isEyeCurve ? 'Mode: CIE 1931 Eye-Curve' : 'Mode: Linear 1:1 Hardware PWM'}</span>
          <span className="text-cyan-400 font-semibold">
            Target: {state.brightness}% ({state.power ? `${physicalDuty} / 4095` : 'OFF'})
          </span>
        </div>
      </div>

      {/* Softness / Non-Blocking Fade Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Softness / Fade</h2>
              <span className="text-[11px] text-gray-500 font-mono">0ms – 3000ms</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
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
            aria-label="Softness Transition Duration Slider"
          />
        </div>

        {/* Presets */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {[
            { label: '0ms', val: 0, sub: 'Instant' },
            { label: '200ms', val: 200, sub: 'Snappy' },
            { label: '400ms', val: 400, sub: 'Smooth' },
            { label: '1000ms', val: 1000, sub: 'Gentle' },
            { label: '2000ms', val: 2000, sub: 'Cinema' },
          ].map((item) => {
            const isSelected = state.softness === item.val;
            return (
              <button
                key={item.val}
                onClick={() => onSoftnessChange(item.val)}
                className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                <span className="text-xs font-semibold font-mono">{item.label}</span>
                <span className="text-[9px] text-gray-500">{item.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware PWM Frequency Card */}
      <div className="w-full bg-gray-950/80 border border-gray-800/90 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col gap-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">PWM Frequency</h2>
              <span className="text-[11px] text-gray-500 font-mono">500 Hz – 25 kHz</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {state.frequency}
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
            aria-label="Hardware PWM Frequency Slider"
          />
        </div>

        {/* Frequency Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { label: '1 kHz', val: 1000, sub: 'Low EMI' },
            { label: '5 kHz', val: 5000, sub: 'Default' },
            { label: '10 kHz', val: 10000, sub: 'No Ripple' },
            { label: '20 kHz', val: 20000, sub: 'Ultrasonic' },
          ].map((item) => {
            const isSelected = state.frequency === item.val;
            return (
              <button
                key={item.val}
                onClick={() => onFrequencyChange(item.val)}
                className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-gray-900/90 border border-gray-800/80 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                <span className="text-xs font-semibold font-mono">{item.label}</span>
                <span className="text-[9px] text-gray-500">{item.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
