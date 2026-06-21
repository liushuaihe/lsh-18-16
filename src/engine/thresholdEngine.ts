import { Device, DeviceStatus, TempSensor, ThresholdAdjustment } from '../types';
import { getActiveDevices } from './dependencyEngine';

export function computeThresholdAdjustments(
  devices: Record<string, Device>,
  sensors: Record<string, TempSensor>,
  deviceId: string
): ThresholdAdjustment[] {
  const adjustments: ThresholdAdjustment[] = [];
  const device = devices[deviceId];
  const sensor = sensors[device?.tempSensorId];
  if (!device || !sensor) return adjustments;

  const activeDevices = getActiveDevices(devices);
  const warningCount = Object.values(devices).filter(
    d => d.status === DeviceStatus.WARNING
  ).length;

  if (device.isCore) {
    const downstreamActive = activeDevices.filter(
      d => d.dependencyIds.includes(deviceId)
    ).length;
    if (downstreamActive >= 2) {
      adjustments.push({
        warningDelta: -5,
        criticalDelta: -3,
        fuseDelta: -2,
        reason: `核心设备运行 + ${downstreamActive}台下游活跃`,
      });
    }
  }

  const avgBaseTemp = Object.values(sensors).reduce((s, x) => s + x.baseTemp, 0) / Math.max(1, Object.keys(sensors).length);
  if (avgBaseTemp > 30) {
    adjustments.push({
      warningDelta: -3,
      criticalDelta: -2,
      fuseDelta: -1,
      reason: `环境温度偏高 (${avgBaseTemp.toFixed(1)}°C)`,
    });
  }

  if (warningCount >= 1) {
    adjustments.push({
      warningDelta: -2,
      criticalDelta: -2,
      fuseDelta: -1,
      reason: `已有 ${warningCount} 台设备报警`,
    });
  }

  const now = Date.now();
  const longRunning = activeDevices.filter(
    d => now - d.lastStatusChange > 4 * 60 * 60 * 1000
  ).length;
  if (longRunning > 0) {
    adjustments.push({
      warningDelta: -4,
      criticalDelta: -3,
      fuseDelta: -2,
      reason: `${longRunning} 台设备连续运行超过4小时`,
    });
  }

  if (device.status === DeviceStatus.WARNING) {
    adjustments.push({
      warningDelta: -1,
      criticalDelta: -1,
      fuseDelta: 0,
      reason: '本设备已处于报警状态',
    });
  }

  return adjustments;
}

export function applyThresholdAdjustments(
  sensor: TempSensor,
  adjustments: ThresholdAdjustment[]
): Pick<TempSensor, 'warningThreshold' | 'criticalThreshold' | 'fuseThreshold'> {
  let wDelta = 0;
  let cDelta = 0;
  let fDelta = 0;
  for (const a of adjustments) {
    wDelta += a.warningDelta;
    cDelta += a.criticalDelta;
    fDelta += a.fuseDelta;
  }
  return {
    warningThreshold: Math.max(30, sensor.baseWarningThreshold + wDelta),
    criticalThreshold: Math.max(35, sensor.baseCriticalThreshold + cDelta),
    fuseThreshold: Math.max(40, sensor.baseFuseThreshold + fDelta),
  };
}

export function recomputeAllThresholds(
  devices: Record<string, Device>,
  sensors: Record<string, TempSensor>
): Record<string, TempSensor> {
  const result: Record<string, TempSensor> = { ...sensors };
  for (const sensor of Object.values(sensors)) {
    const adjustments = computeThresholdAdjustments(devices, sensors, sensor.deviceId);
    const newThresholds = applyThresholdAdjustments(sensor, adjustments);
    result[sensor.id] = {
      ...sensor,
      ...newThresholds,
    };
  }
  return result;
}

export function evaluateAlertLevel(
  currentTemp: number,
  thresholds: { warningThreshold: number; criticalThreshold: number; fuseThreshold: number }
): TempSensor['alertLevel'] {
  const { warningThreshold, criticalThreshold, fuseThreshold } = thresholds;
  if (currentTemp >= fuseThreshold) return 'fuse';
  if (currentTemp >= criticalThreshold) return 'critical';
  if (currentTemp >= warningThreshold) return 'warning';
  return 'normal';
}
