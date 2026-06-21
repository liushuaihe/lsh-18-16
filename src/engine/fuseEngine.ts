import { Device, DeviceStatus, TempSensor, Alert, AlertLevel } from '../types';
import { getAllDownstreamRecursive } from './dependencyEngine';
import { applyTransition } from './stateMachine';

export interface FuseResult {
  triggered: boolean;
  affectedDeviceIds: string[];
  reason?: string;
  alert?: Alert;
}

export function checkAndTriggerFuse(
  devices: Record<string, Device>,
  sensors: Record<string, TempSensor>,
  alerts: Alert[],
  now: number
): {
  devices: Record<string, Device>;
  sensors: Record<string, TempSensor>;
  alerts: Alert[];
  globalFuseActive: boolean;
  fuseReason?: string;
  fuseTimestamp?: number;
} {
  let updatedDevices = { ...devices };
  let updatedSensors = { ...sensors };
  let updatedAlerts = [...alerts];
  let globalFuseActive = false;
  let fuseReason: string | undefined;
  let fuseTimestamp: number | undefined;

  for (const sensor of Object.values(sensors)) {
    if (sensor.currentTemp >= sensor.fuseThreshold) {
      const device = updatedDevices[sensor.deviceId];
      if (!device) continue;
      if (device.status === DeviceStatus.FUSED) continue;

      const allAffected: string[] = [sensor.deviceId, ...getAllDownstreamRecursive(sensor.deviceId, updatedDevices)];

      for (const devId of allAffected) {
        const dev = updatedDevices[devId];
        if (!dev) continue;
        if (dev.status !== DeviceStatus.OFF && dev.status !== DeviceStatus.FAULT) {
          const transitioned = applyTransition(dev, { type: 'FUSE' });
          if (transitioned) {
            updatedDevices[devId] = transitioned;
          }
        }
        const s = updatedSensors[dev.tempSensorId];
        if (s) {
          updatedSensors[dev.tempSensorId] = {
            ...s,
            alertLevel: 'fuse',
            currentTemp: Math.max(s.currentTemp, s.fuseThreshold),
          };
        }
      }

      globalFuseActive = true;
      fuseReason = `设备 [${device.name}] 温度达到熔断阈值 (${sensor.currentTemp.toFixed(1)}°C >= ${sensor.fuseThreshold.toFixed(1)}°C)`;
      fuseTimestamp = now;

      const alertId = `FUSE-${now}-${sensor.id}`;
      const alreadyExists = updatedAlerts.some(a => a.id === alertId || (a.sensorId === sensor.id && a.level === 'fuse'));
      if (!alreadyExists) {
        updatedAlerts.unshift({
          id: alertId,
          timestamp: now,
          deviceId: sensor.deviceId,
          sensorId: sensor.id,
          level: 'fuse',
          message: fuseReason,
          temperature: sensor.currentTemp,
          threshold: sensor.fuseThreshold,
          acknowledged: false,
        });
      }
      break;
    }
  }

  if (!globalFuseActive) {
    const criticalCount = Object.values(sensors).filter(s => s.alertLevel === 'critical').length;
    const faultCount = Object.values(devices).filter(d => d.status === DeviceStatus.FAULT).length;

    if (criticalCount >= 3 || faultCount >= 2) {
      globalFuseActive = true;
      fuseReason = `系统性风险触发熔断: ${criticalCount}路严重温度告警 / ${faultCount}台设备故障`;
      fuseTimestamp = now;

      for (const [devId, dev] of Object.entries(updatedDevices)) {
        if (dev.status === DeviceStatus.ON || dev.status === DeviceStatus.STANDBY || dev.status === DeviceStatus.WARNING || dev.status === DeviceStatus.FAULT) {
          const transitioned = applyTransition(dev, { type: 'FUSE' });
          if (transitioned) {
            updatedDevices[devId] = transitioned;
          }
        }
      }

      const alertId = `FUSE-GLOBAL-${now}`;
      updatedAlerts.unshift({
        id: alertId,
        timestamp: now,
        deviceId: 'SYSTEM',
        sensorId: 'GLOBAL',
        level: 'fuse',
        message: fuseReason,
        acknowledged: false,
      });
    }
  }

  return {
    devices: updatedDevices,
    sensors: updatedSensors,
    alerts: updatedAlerts.slice(0, 100),
    globalFuseActive,
    fuseReason,
    fuseTimestamp,
  };
}

export function createTemperatureAlert(
  device: Device,
  sensor: TempSensor,
  level: AlertLevel,
  now: number
): Alert | null {
  if (level === 'fuse') return null;

  const thresholds: Record<AlertLevel, { name: string; field: keyof TempSensor }> = {
    warning: { name: '警示', field: 'warningThreshold' },
    critical: { name: '严重', field: 'criticalThreshold' },
    fuse: { name: '熔断', field: 'fuseThreshold' },
  };
  const th = thresholds[level];
  const thresholdVal = sensor[th.field] as number;

  return {
    id: `ALERT-${level}-${now}-${sensor.id}`,
    timestamp: now,
    deviceId: device.id,
    sensorId: sensor.id,
    level,
    message: `${level === 'warning' ? '⚠️' : '🔴'} [${device.name}] 温度${th.name}: ${sensor.currentTemp.toFixed(1)}°C >= ${thresholdVal.toFixed(1)}°C`,
    temperature: sensor.currentTemp,
    threshold: thresholdVal,
    acknowledged: false,
  };
}
