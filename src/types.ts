export interface ControllerSettings {
  mdnsHost: string;
  wifiSsid: string;
  pwmGpio: number;
  uptime: number;
  freeHeap: number;
  rssi: number;
  ip: string;
  mac: string;
  chip: string;
  compileDate: string;
}

export interface CountdownTimerState {
  active: boolean;
  durationSec: number;
  remainingSec: number;
  action: 'on' | 'off';
}

export interface ControllerState {
  power: boolean;
  brightness: number; // 1 to 100
  softness: number;   // 0 to 3000 ms
  frequency: number;  // 500 to 25000 Hz
  curveMode: number;  // 0 = Linear 1:1 (Default), 1 = Gamma 2.2
  timer: CountdownTimerState;
  settings: ControllerSettings;
}

export type TabType = 'controller' | 'timer' | 'settings' | 'firmware';
export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'error';
