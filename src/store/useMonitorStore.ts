import { create } from 'zustand';
import {
  Device,
  DeviceStatus,
  TempSensor,
  Alert,
  ToggleResult,
  TracePath,
} from '../types';
import { MOCK_DEVICES, MOCK_SENSORS } from '../data/mockData';
import {
  canDeviceStart,
  getDependencyOrder,
  getAllDownstreamRecursive,
  buildTracePath,
} from '../engine/dependencyEngine';
import { applyTransition, isDeviceRunning } from '../engine/stateMachine';
import { recomputeAllThresholds, evaluateAlertLevel } from '../engine/thresholdEngine';
import { checkAndTriggerFuse, createTemperatureAlert } from '../engine/fuseEngine';
import {
  tickDeviceLife,
  applyFaultPenalty,
  applyFusePenalty,
  isChainStartAllowed,
  resetLifeStats,
} from '../engine/lifeEngine';

interface MonitorStore {
  devices: Record<string, Device>;
  sensors: Record<string, TempSensor>;
  alerts: Alert[];
  globalFuseActive: boolean;
  fuseReason?: string;
  fuseTimestamp?: number;
  tracePath: TracePath | null;
  visualFlash: 'fault' | 'fuse' | null;

  toggleDevice: (deviceId: string) => ToggleResult;
  startDependencyChain: (deviceId: string) => ToggleResult;
  simulateFault: (deviceId: string, faultCode: string) => void;
  simulateSpike: (deviceId: string, targetTemp: number) => void;
  acknowledgeAlert: (alertId: string) => void;
  resetFuse: () => void;
  forceShutdownAll: () => void;
  clearTracePath: () => void;
  setVisualFlash: (v: 'fault' | 'fuse' | null) => void;
  tickTemperature: () => void;
  updateSensorTemp: (sensorId: string, temp: number) => void;
  resetDeviceLife: (deviceId: string) => void;
}

export const useMonitorStore = create<MonitorStore>((set, get) => ({
  devices: { ...MOCK_DEVICES },
  sensors: { ...MOCK_SENSORS },
  alerts: [],
  globalFuseActive: false,
  tracePath: null,
  visualFlash: null,

  toggleDevice: (deviceId: string) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return { success: false, message: '设备不存在' };

    if (state.globalFuseActive) {
      return { success: false, message: '全局熔断激活，无法操作设备' };
    }

    if (isDeviceRunning(device.status) || device.status === DeviceStatus.STANDBY) {
      const downstream = getAllDownstreamRecursive(deviceId, state.devices);
      const stillRunning = downstream.filter(id => isDeviceRunning(state.devices[id].status));
      if (stillRunning.length > 0) {
        return {
          success: false,
          message: `存在下游设备仍在运行，请先关闭: ${stillRunning.map(id => state.devices[id]?.name).join('、')}`,
          blockedDependencies: stillRunning,
        };
      }

      const transitioned = applyTransition(device, { type: 'TURN_OFF' });
      if (!transitioned) return { success: false, message: '状态转换失败' };

      set(() => {
        let newDevices = { ...state.devices, [deviceId]: transitioned };
        let newSensors = recomputeAllThresholds(newDevices, state.sensors);
        if (newSensors[device.tempSensorId]) {
          newSensors = {
            ...newSensors,
            [device.tempSensorId]: {
              ...newSensors[device.tempSensorId],
              currentTemp: newSensors[device.tempSensorId].baseTemp,
              alertLevel: 'normal',
            },
          };
        }
        return { devices: newDevices, sensors: newSensors };
      });
      return { success: true };
    }

    const check = canDeviceStart(device, state.devices);
    if (!check.canStart) {
      const missingNames = check.missingDeps.map(id => state.devices[id]?.name || id).join('、');
      return {
        success: false,
        message: `依赖设备未就绪: ${missingNames}`,
        blockedDependencies: check.missingDeps,
      };
    }

    const transitioned = applyTransition(device, { type: 'TURN_ON' });
    if (!transitioned) return { success: false, message: '状态转换失败' };

    set(() => {
      let newDevices = { ...state.devices, [deviceId]: transitioned };
      const newSensors = recomputeAllThresholds(newDevices, state.sensors);
      return { devices: newDevices, sensors: newSensors };
    });

    setTimeout(() => {
      const s = get();
      const dev = s.devices[deviceId];
      if (dev && dev.status === DeviceStatus.STANDBY) {
        const selfChecked = applyTransition(dev, { type: 'SELF_CHECK_DONE' });
        if (selfChecked) {
          set(prev => {
            const nd = { ...prev.devices, [deviceId]: selfChecked };
            const ns = recomputeAllThresholds(nd, prev.sensors);
            return { devices: nd, sensors: ns };
          });
        }
      }
    }, 600 + Math.random() * 400);

    return { success: true };
  },

  startDependencyChain: (deviceId: string) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return { success: false, message: '设备不存在' };

    if (state.globalFuseActive) {
      return { success: false, message: '全局熔断激活，无法操作设备' };
    }

    if (!isChainStartAllowed(device.lifeStats)) {
      return { success: false, message: `设备健康分 ${device.lifeStats.healthScore} 低于60，限制链启` };
    }

    const order = getDependencyOrder(deviceId, state.devices);
    const failedOn: string[] = [];

    for (const id of order) {
      if (id === deviceId && isDeviceRunning(state.devices[id].status)) continue;
      const devInChain = state.devices[id];
      if (id !== deviceId && devInChain && !isChainStartAllowed(devInChain.lifeStats)) {
        failedOn.push(`${devInChain.name}: 健康分 ${devInChain.lifeStats.healthScore} 低于60，限制链启`);
        continue;
      }
      const result = get().toggleDevice(id);
      if (!result.success) {
        failedOn.push(`${state.devices[id]?.name || id}: ${result.message}`);
      }
    }

    return {
      success: failedOn.length === 0,
      message: failedOn.length > 0 ? `部分设备启动失败: ${failedOn.join('; ')}` : '依赖链启动完成',
    };
  },

  simulateFault: (deviceId: string, faultCode: string) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return;

    const transitioned = applyTransition(device, { type: 'FAULT', faultCode });
    if (!transitioned) return;

    let newDevices = { ...state.devices, [deviceId]: transitioned };

    newDevices[deviceId] = {
      ...newDevices[deviceId],
      lifeStats: applyFaultPenalty(newDevices[deviceId].lifeStats),
    };

    const downstream = getAllDownstreamRecursive(deviceId, state.devices);

    for (const dId of downstream) {
      const dev = newDevices[dId];
      if (!dev) continue;
      if (dev.status !== DeviceStatus.OFF && dev.status !== DeviceStatus.FAULT && dev.status !== DeviceStatus.FUSED) {
        const blocked = applyTransition(dev, {
          type: 'BLOCK',
          reason: `上游设备 [${device.name}] 故障 (${faultCode})`,
        });
        if (blocked) newDevices[dId] = blocked;
      }
    }

    let newSensors = recomputeAllThresholds(newDevices, state.sensors);
    for (const dId of [deviceId, ...downstream]) {
      const dev = newDevices[dId];
      if (dev && newSensors[dev.tempSensorId]) {
        newSensors = {
          ...newSensors,
          [dev.tempSensorId]: {
            ...newSensors[dev.tempSensorId],
            alertLevel: 'critical',
            currentTemp: Math.min(
              newSensors[dev.tempSensorId].currentTemp + 5,
              newSensors[dev.tempSensorId].fuseThreshold + 2
            ),
          },
        };
      }
    }

    const trace = buildTracePath(deviceId, newDevices);
    const now = Date.now();
    const newAlerts = [...state.alerts];
    newAlerts.unshift({
      id: `FAULT-${now}-${deviceId}`,
      timestamp: now,
      deviceId,
      sensorId: device.tempSensorId,
      level: 'critical',
      message: `🔴 [${device.name}] 硬件故障: 代码 ${faultCode}`,
      acknowledged: false,
    });

    set({
      devices: newDevices,
      sensors: newSensors,
      alerts: newAlerts.slice(0, 100),
      tracePath: trace,
      visualFlash: 'fault',
    });

    setTimeout(() => get().setVisualFlash(null), 1200);
  },

  simulateSpike: (deviceId: string, targetTemp: number) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return;
    const sensor = state.sensors[device.tempSensorId];
    if (!sensor) return;
    get().updateSensorTemp(sensor.id, targetTemp);
  },

  acknowledgeAlert: (alertId: string) => {
    set(prev => ({
      alerts: prev.alerts.map(a => (a.id === alertId ? { ...a, acknowledged: true } : a)),
    }));
  },

  resetFuse: () => {
    const state = get();
    if (!state.globalFuseActive) return;

    const newDevices: Record<string, Device> = {};
    for (const [id, dev] of Object.entries(state.devices)) {
      if (dev.status === DeviceStatus.FUSED) {
        const reset = applyTransition(dev, { type: 'RESET_FAULT' });
        newDevices[id] = reset || dev;
      } else if (dev.status === DeviceStatus.BLOCKED) {
        const unblocked = applyTransition(dev, { type: 'UNBLOCK' });
        newDevices[id] = unblocked || dev;
      } else {
        newDevices[id] = dev;
      }
    }

    const newSensors: Record<string, TempSensor> = {};
    for (const [id, s] of Object.entries(state.sensors)) {
      newSensors[id] = {
        ...s,
        currentTemp: s.baseTemp,
        alertLevel: 'normal',
        tempHistory: [],
      };
    }

    set({
      devices: newDevices,
      sensors: recomputeAllThresholds(newDevices, newSensors),
      globalFuseActive: false,
      fuseReason: undefined,
      fuseTimestamp: undefined,
      tracePath: null,
    });
  },

  forceShutdownAll: () => {
    const state = get();
    const newDevices: Record<string, Device> = {};
    for (const [id, dev] of Object.entries(state.devices)) {
      if (dev.status !== DeviceStatus.OFF && dev.status !== DeviceStatus.FAULT && dev.status !== DeviceStatus.FUSED) {
        const off = applyTransition(dev, { type: 'TURN_OFF' });
        newDevices[id] = off || dev;
      } else {
        newDevices[id] = dev;
      }
    }
    const newSensors: Record<string, TempSensor> = {};
    for (const [id, s] of Object.entries(state.sensors)) {
      newSensors[id] = {
        ...s,
        currentTemp: s.baseTemp,
        alertLevel: 'normal',
        tempHistory: [],
      };
    }
    set({
      devices: newDevices,
      sensors: recomputeAllThresholds(newDevices, newSensors),
      globalFuseActive: false,
      fuseReason: undefined,
    });
  },

  clearTracePath: () => set({ tracePath: null }),
  setVisualFlash: (v) => set({ visualFlash: v }),

  tickTemperature: () => {
    const state = get();
    const now = Date.now();
    let newSensors: Record<string, TempSensor> = { ...state.sensors };
    let newAlerts = [...state.alerts];
    let newDevices = { ...state.devices };
    const TICK_INTERVAL_SEC = 0.5;

    for (const sensor of Object.values(state.sensors)) {
      const dev = state.devices[sensor.deviceId];
      if (!dev) continue;

      let target = sensor.baseTemp;
      let drift = 0;

      if (dev.status === DeviceStatus.STANDBY) {
        target = sensor.targetTemp * 0.5 + sensor.baseTemp * 0.5;
        drift = (Math.random() - 0.45) * 0.8;
      } else if (dev.status === DeviceStatus.ON || dev.status === DeviceStatus.WARNING) {
        target = sensor.targetTemp;
        drift = (Math.random() - 0.45) * 1.8;
        if (dev.isCore) drift += (Math.random() * 0.6);
      } else {
        target = sensor.baseTemp;
        drift = (Math.random() - 0.5) * 0.3;
      }

      const diff = target - sensor.currentTemp;
      const nextVal = sensor.currentTemp + diff * 0.05 + drift;

      const hist = [...sensor.tempHistory, { t: now, v: nextVal }];
      while (hist.length > 0 && now - hist[0].t > 60 * 1000) hist.shift();

      newSensors[sensor.id] = {
        ...newSensors[sensor.id],
        currentTemp: nextVal,
        tempHistory: hist,
      };
    }

    for (const sid of Object.keys(newSensors)) {
      const s = newSensors[sid];
      const dev = newDevices[s.deviceId];
      if (!dev) continue;

      const level = evaluateAlertLevel(s.currentTemp, s);
      newSensors[sid] = { ...s, alertLevel: level };

      if (dev.status === DeviceStatus.ON && level === 'warning') {
        const warned = applyTransition(dev, { type: 'TEMP_WARNING' });
        if (warned) newDevices[s.deviceId] = warned;
        const alert = createTemperatureAlert(dev, s, 'warning', now);
        if (alert && !newAlerts.some(a => a.sensorId === sid && a.level === 'warning' && (now - a.timestamp) < 5000)) {
          newAlerts.unshift(alert);
        }
      } else if (dev.status === DeviceStatus.WARNING && level === 'normal') {
        const back = applyTransition(dev, { type: 'TEMP_NORMAL' });
        if (back) newDevices[s.deviceId] = back;
      } else if (level === 'critical') {
        const dev2 = newDevices[s.deviceId];
        if (dev2 && dev2.status !== DeviceStatus.FAULT && dev2.status !== DeviceStatus.FUSED) {
          const crit = applyTransition(dev2, { type: 'FAULT', faultCode: 'TEMP-CRIT' });
          if (crit) {
            newDevices[s.deviceId] = {
              ...crit,
              lifeStats: applyFaultPenalty(crit.lifeStats),
            };
            const downstream = getAllDownstreamRecursive(s.deviceId, newDevices);
            for (const dId of downstream) {
              const dd = newDevices[dId];
              if (dd && dd.status !== DeviceStatus.OFF && dd.status !== DeviceStatus.FAULT && dd.status !== DeviceStatus.FUSED) {
                const blocked = applyTransition(dd, { type: 'BLOCK', reason: `上游温度严重告警` });
                if (blocked) newDevices[dId] = blocked;
              }
            }
          }
        }
        const alert = createTemperatureAlert(dev, s, 'critical', now);
        if (alert && !newAlerts.some(a => a.sensorId === sid && a.level === 'critical' && (now - a.timestamp) < 3000)) {
          newAlerts.unshift(alert);
        }
      }
    }

    newSensors = recomputeAllThresholds(newDevices, newSensors);

    const fuseResult = checkAndTriggerFuse(newDevices, newSensors, newAlerts, now);
    if (fuseResult.globalFuseActive && !state.globalFuseActive) {
      for (const [dId, d] of Object.entries(fuseResult.devices)) {
        if (d.status === DeviceStatus.FUSED && state.devices[dId]?.status !== DeviceStatus.FUSED) {
          fuseResult.devices[dId] = {
            ...d,
            lifeStats: applyFusePenalty(d.lifeStats),
          };
        }
      }
      setTimeout(() => get().setVisualFlash('fuse'), 0);
      setTimeout(() => get().setVisualFlash(null), 1500);
    }

    for (const [dId, fusedDev] of Object.entries(fuseResult.devices)) {
      newDevices[dId] = fusedDev;
    }

    for (const [dId, dev] of Object.entries(newDevices)) {
      const sensor = newSensors[dev.tempSensorId];
      if (!sensor) continue;
      const updatedLife = tickDeviceLife(dev, sensor, TICK_INTERVAL_SEC, now);
      newDevices[dId] = {
        ...newDevices[dId],
        lifeStats: updatedLife,
      };
    }

    set({
      devices: newDevices,
      sensors: fuseResult.sensors,
      alerts: fuseResult.alerts.slice(0, 100),
      globalFuseActive: fuseResult.globalFuseActive,
      fuseReason: fuseResult.fuseReason,
      fuseTimestamp: fuseResult.fuseTimestamp,
    });
  },

  resetDeviceLife: (deviceId: string) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return;
    const sensor = state.sensors[device.tempSensorId];
    const baseTemp = sensor?.baseTemp ?? 25;
    set(prev => ({
      devices: {
        ...prev.devices,
        [deviceId]: {
          ...prev.devices[deviceId],
          lifeStats: resetLifeStats(baseTemp),
        },
      },
    }));
  },

  updateSensorTemp: (sensorId: string, temp: number) => {
    const state = get();
    const sensor = state.sensors[sensorId];
    if (!sensor) return;
    const now = Date.now();
    const hist = [...sensor.tempHistory, { t: now, v: temp }];
    while (hist.length > 0 && now - hist[0].t > 60 * 1000) hist.shift();
    set(prev => ({
      sensors: {
        ...prev.sensors,
        [sensorId]: { ...prev.sensors[sensorId], currentTemp: temp, tempHistory: hist },
      },
    }));
    setTimeout(() => get().tickTemperature(), 0);
  },
}));

const LIFESTATS_STORAGE_KEY = 'monitor:lifeStats';

type PersistedLifeStats = Record<string, Device['lifeStats']>;

function loadLifeStatsFromStorage(): PersistedLifeStats | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(LIFESTATS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedLifeStats;
  } catch {
    return null;
  }
}

function saveLifeStatsToStorage(devices: Record<string, Device>): void {
  try {
    if (typeof window === 'undefined') return;
    const payload: PersistedLifeStats = {};
    for (const [id, dev] of Object.entries(devices)) {
      payload[id] = dev.lifeStats;
    }
    window.localStorage.setItem(LIFESTATS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

const persisted = loadLifeStatsFromStorage();
if (persisted) {
  useMonitorStore.setState((prev) => {
    const merged: Record<string, Device> = {};
    for (const [id, dev] of Object.entries(prev.devices)) {
      merged[id] = persisted[id]
        ? { ...dev, lifeStats: persisted[id] }
        : dev;
    }
    return { devices: merged };
  });
}

useMonitorStore.subscribe((state) => {
  saveLifeStatsToStorage(state.devices);
});
