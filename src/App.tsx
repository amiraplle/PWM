/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ControllerState, TabType, ConnectionStatus } from './types';
import { esp32Client, INITIAL_STATE } from './services/esp32Api';
import { Header } from './components/Header';
import { MainController } from './components/MainController';
import { CountdownTimerView } from './components/CountdownTimerView';
import { SettingsView } from './components/SettingsView';
import { FirmwareView } from './components/FirmwareView';
import { BottomNav } from './components/BottomNav';
import { SerialConsoleModal } from './components/SerialConsoleModal';

export default function App() {
  const [state, setState] = useState<ControllerState>(INITIAL_STATE);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [currentTab, setCurrentTab] = useState<TabType>('controller');
  const [targetHost, setTargetHost] = useState<string>(esp32Client.getTargetHost());
  const [useProxy, setUseProxy] = useState<boolean>(esp32Client.getUseProxy());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isSerialOpen, setIsSerialOpen] = useState(false);

  // Debounce timers to avoid writing to NVS while dragging sliders
  const brightnessDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const softnessDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const frequencyDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Poll state from ESP32
  const syncState = useCallback(async () => {
    setIsPolling(true);
    try {
      const remoteState = await esp32Client.fetchState();
      setState((prev) => ({
        ...remoteState,
        // Preserve local settings if remote is missing any fields
        settings: {
          ...prev.settings,
          ...remoteState.settings,
        },
      }));
      setStatus('connected');
    } catch {
      // In development or when physical board is offline, keep responsive fallback
      setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'offline'));
    } finally {
      setIsPolling(false);
    }
  }, []);

  // Initial sync & interval polling (only when page is visible)
  useEffect(() => {
    syncState();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncState();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [syncState]);

  // Local timer tick for active countdown display
  useEffect(() => {
    if (!state.timer.active || state.timer.remainingSec <= 0) return;

    const tick = setInterval(() => {
      setState((prev) => {
        if (!prev.timer.active || prev.timer.remainingSec <= 0) return prev;
        const newSec = prev.timer.remainingSec - 1;
        if (newSec <= 0) {
          return {
            ...prev,
            power: prev.timer.action === 'on',
            timer: {
              ...prev.timer,
              active: false,
              remainingSec: 0,
            },
          };
        }
        return {
          ...prev,
          timer: {
            ...prev.timer,
            remainingSec: newSec,
          },
        };
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [state.timer.active, state.timer.remainingSec]);

  // Handlers for Main Controller
  const handleTogglePower = async () => {
    const prevPower = state.power;
    const nextPower = !state.power;

    try {
      setIsUpdating(true);
      const res = await esp32Client.setPower(nextPower);
      setState(res);
      setStatus('connected');
    } catch (err: any) {
      // Revert state on failure — never fake success
      setState((prev) => ({ ...prev, power: prevPower }));
      setStatus('offline');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBrightnessChange = (val: number) => {
    // STRICT REQUIREMENT: Range MUST be 1–100%. 0% is forbidden.
    const clamped = Math.max(1, Math.min(100, Math.round(val)));
    const prevBrightness = state.brightness;

    // Local UI update while dragging
    setState((prev) => ({ ...prev, brightness: clamped }));

    if (brightnessDebounceRef.current) {
      clearTimeout(brightnessDebounceRef.current);
    }

    // Debounce network write
    brightnessDebounceRef.current = setTimeout(async () => {
      try {
        const res = await esp32Client.setBrightness(clamped);
        setState(res);
        setStatus('connected');
      } catch {
        setState((prev) => ({ ...prev, brightness: prevBrightness }));
        setStatus('offline');
      }
    }, 100);
  };

  const handleSoftnessChange = (val: number) => {
    const clamped = Math.max(0, Math.min(3000, Math.round(val)));
    const prevSoftness = state.softness;
    setState((prev) => ({ ...prev, softness: clamped }));

    if (softnessDebounceRef.current) {
      clearTimeout(softnessDebounceRef.current);
    }

    softnessDebounceRef.current = setTimeout(async () => {
      try {
        const res = await esp32Client.setSoftness(clamped);
        setState(res);
        setStatus('connected');
      } catch {
        setState((prev) => ({ ...prev, softness: prevSoftness }));
        setStatus('offline');
      }
    }, 120);
  };

  const handleFrequencyChange = (val: number) => {
    const clamped = Math.max(500, Math.min(25000, Math.round(val)));
    const prevFrequency = state.frequency;
    setState((prev) => ({ ...prev, frequency: clamped }));

    if (frequencyDebounceRef.current) {
      clearTimeout(frequencyDebounceRef.current);
    }

    frequencyDebounceRef.current = setTimeout(async () => {
      try {
        const res = await esp32Client.setFrequency(clamped);
        setState(res);
        setStatus('connected');
      } catch {
        setState((prev) => ({ ...prev, frequency: prevFrequency }));
        setStatus('offline');
      }
    }, 150);
  };

  // Timer Handlers
  const handleStartTimer = async (durationSec: number, action: 'on' | 'off') => {
    try {
      setIsUpdating(true);
      const res = await esp32Client.startTimer(durationSec, action);
      setState(res);
      setStatus('connected');
    } catch {
      setStatus('offline');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelTimer = async () => {
    try {
      setIsUpdating(true);
      const res = await esp32Client.cancelTimer();
      setState(res);
      setStatus('connected');
    } catch {
      setStatus('offline');
    } finally {
      setIsUpdating(false);
    }
  };

  // Settings Handlers
  const handleUpdateTargetHost = (newHost: string) => {
    esp32Client.setTargetHost(newHost);
    setTargetHost(esp32Client.getTargetHost());
    syncState();
  };

  const handleToggleProxy = (newVal: boolean) => {
    esp32Client.setUseProxy(newVal);
    setUseProxy(newVal);
    syncState();
  };

  const handleUpdateSettings = async (newSettings: {
    pwmGpio?: number;
    mdnsHost?: string;
    wifiSsid?: string;
    wifiPass?: string;
    curveMode?: number;
  }) => {
    try {
      setIsUpdating(true);
      const res = await esp32Client.updateSettings(newSettings);
      setState(res);
      setStatus('connected');
    } catch {
      setStatus('offline');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCurveChange = (curve: number) => {
    handleUpdateSettings({ curveMode: curve });
  };

  const handleReboot = async () => {
    try {
      setIsUpdating(true);
      await esp32Client.rebootDevice();
      setStatus('connecting');
      setTimeout(syncState, 3000);
    } catch {
      // Offline fallback
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        status={status}
        targetHost={targetHost}
        isPolling={isPolling}
        onRefresh={syncState}
        onOpenSerial={() => setIsSerialOpen(true)}
        onOpenFirmware={() => setCurrentTab('firmware')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-24">
        {status === 'offline' && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-lg">
            <span>⚠️ ESP32 offline at <code className="font-mono font-bold text-white">{targetHost}</code>. Connect to ESP32 Wi-Fi or verify address.</span>
            <button
              onClick={syncState}
              className="px-2.5 py-1 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-white font-semibold text-[11px] whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {currentTab === 'controller' && (
          <MainController
            state={state}
            onTogglePower={handleTogglePower}
            onBrightnessChange={handleBrightnessChange}
            onSoftnessChange={handleSoftnessChange}
            onFrequencyChange={handleFrequencyChange}
            onCurveChange={handleCurveChange}
            isUpdating={isUpdating}
          />
        )}

        {currentTab === 'timer' && (
          <CountdownTimerView
            timer={state.timer}
            onStartTimer={handleStartTimer}
            onCancelTimer={handleCancelTimer}
            isUpdating={isUpdating}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            settings={state.settings}
            targetHost={targetHost}
            useProxy={useProxy}
            curveMode={state.curveMode}
            onUpdateTargetHost={handleUpdateTargetHost}
            onToggleProxy={handleToggleProxy}
            onUpdateSettings={handleUpdateSettings}
            onReboot={handleReboot}
            onOpenFirmware={() => setCurrentTab('firmware')}
            isUpdating={isUpdating}
          />
        )}

        {currentTab === 'firmware' && <FirmwareView />}
      </main>

      {/* Bottom Tuya Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        isTimerActive={state.timer.active}
      />

      {/* USB-C Web Serial Monitor Modal */}
      <SerialConsoleModal
        isOpen={isSerialOpen}
        onClose={() => setIsSerialOpen(false)}
      />
    </div>
  );
}
