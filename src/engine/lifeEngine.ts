import { Device, LifeStats, TempSensor } from '../types';
import { isDeviceRunning } from './stateMachine';

const HEALTH_MIN = 0;
const HEALTH_MAX = 100;
const HEALTH_CHAIN_LIMIT = 60;

const THERMAL_SHOCK_THRESHOLD = 5;
const THERMAL_SHOCK_COOLDOWN_MS = 3000;

const RUNNING_SECONDS_PENALTY_PER_100S = 0.15;
const THERMAL_SHOCK_PENALTY = 3;
const FAULT_PENALTY = 5;
const FUSE_PENALTY = 8;

export function createDefaultLifeStats(baseTemp: number): LifeStats {
  return {
    runningSeconds: 0,
    thermalShocks: 0,
    healthScore: HEALTH_MAX,
    lastTempForShock: baseTemp,
    lastShockTime: 0,
  };
}

export function detectThermalShock(
  lifeStats: LifeStats,
  currentTemp: number,
  now: number
): { shocked: boolean; updatedStats: LifeStats } {
  const delta = Math.abs(currentTemp - lifeStats.lastTempForShock);
  const cooldownPassed = now - lifeStats.lastShockTime > THERMAL_SHOCK_COOLDOWN_MS;

  if (delta >= THERMAL_SHOCK_THRESHOLD && cooldownPassed) {
    const updated: LifeStats = {
      ...lifeStats,
      thermalShocks: lifeStats.thermalShocks + 1,
      lastShockTime: now,
      lastTempForShock: currentTemp,
    };
    return { shocked: true, updatedStats: updated };
  }

  return {
    shocked: false,
    updatedStats: { ...lifeStats, lastTempForShock: currentTemp },
  };
}

export function computeHealthScore(lifeStats: LifeStats): number {
  const runPenalty = (lifeStats.runningSeconds / 100) * RUNNING_SECONDS_PENALTY_PER_100S;
  const shockPenalty = lifeStats.thermalShocks * THERMAL_SHOCK_PENALTY;
  const score = HEALTH_MAX - runPenalty - shockPenalty;
  return Math.max(HEALTH_MIN, Math.min(HEALTH_MAX, Math.round(score * 10) / 10));
}

export function applyFaultPenalty(lifeStats: LifeStats): LifeStats {
  return {
    ...lifeStats,
    healthScore: Math.max(HEALTH_MIN, lifeStats.healthScore - FAULT_PENALTY),
  };
}

export function applyFusePenalty(lifeStats: LifeStats): LifeStats {
  return {
    ...lifeStats,
    healthScore: Math.max(HEALTH_MIN, lifeStats.healthScore - FUSE_PENALTY),
  };
}

export function isChainStartAllowed(lifeStats: LifeStats): boolean {
  return lifeStats.healthScore >= HEALTH_CHAIN_LIMIT;
}

export function getHealthLevel(score: number): 'good' | 'warn' | 'critical' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'critical';
}

export function tickDeviceLife(
  device: Device,
  sensor: TempSensor,
  tickIntervalSec: number,
  now: number
): LifeStats {
  let stats = { ...device.lifeStats };

  if (isDeviceRunning(device.status)) {
    stats.runningSeconds += tickIntervalSec;
  }

  const { shocked, updatedStats } = detectThermalShock(stats, sensor.currentTemp, now);
  stats = updatedStats;

  if (shocked) {
    stats.healthScore = Math.max(HEALTH_MIN, stats.healthScore - THERMAL_SHOCK_PENALTY);
  }

  stats.healthScore = computeHealthScore(stats);

  return stats;
}

export function resetLifeStats(baseTemp: number): LifeStats {
  return createDefaultLifeStats(baseTemp);
}
