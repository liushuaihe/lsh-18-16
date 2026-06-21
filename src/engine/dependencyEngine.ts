import { Device, DeviceStatus, TracePath, TraceStep } from '../types';

export function canDeviceStart(
  device: Device,
  devices: Record<string, Device>
): { canStart: boolean; missingDeps: string[] } {
  if (device.status === DeviceStatus.ON || device.status === DeviceStatus.STANDBY) {
    return { canStart: true, missingDeps: [] };
  }
  if (device.status === DeviceStatus.FAULT || device.status === DeviceStatus.FUSED) {
    return { canStart: false, missingDeps: [] };
  }
  const missingDeps: string[] = [];
  for (const depId of device.dependencyIds) {
    const dep = devices[depId];
    if (!dep || (dep.status !== DeviceStatus.ON && dep.status !== DeviceStatus.STANDBY)) {
      missingDeps.push(depId);
    }
  }
  return { canStart: missingDeps.length === 0, missingDeps };
}

export function getDependencyOrder(
  targetDeviceId: string,
  devices: Record<string, Device>
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const dev = devices[id];
    if (!dev) return;
    for (const depId of dev.dependencyIds) {
      visit(depId);
    }
    result.push(id);
  }

  visit(targetDeviceId);
  return result;
}

export function getDownstreamDevices(
  deviceId: string,
  devices: Record<string, Device>
): string[] {
  const downstream: string[] = [];
  for (const [id, dev] of Object.entries(devices)) {
    if (dev.dependencyIds.includes(deviceId)) {
      downstream.push(id);
    }
  }
  return downstream;
}

export function getAllDownstreamRecursive(
  deviceId: string,
  devices: Record<string, Device>
): string[] {
  const result = new Set<string>();
  const queue = [deviceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const direct = getDownstreamDevices(current, devices);
    for (const d of direct) {
      if (!result.has(d)) {
        result.add(d);
        queue.push(d);
      }
    }
  }
  return Array.from(result);
}

export function buildTracePath(
  faultDeviceId: string,
  devices: Record<string, Device>
): TracePath {
  const faultDevice = devices[faultDeviceId];
  const steps: TraceStep[] = [];
  const visited = new Set<string>();

  function traverse(id: string, level: number, parentReason?: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const dev = devices[id];
    if (!dev) return;

    let reason = parentReason;
    if (id === faultDeviceId) {
      reason = `故障代码: ${dev.faultCode || '未知'}`;
    } else if (parentReason) {
      reason = `上游阻断: ${devices[dev.dependencyIds.find(d => devices[d]?.status === DeviceStatus.FAULT || devices[d]?.status === DeviceStatus.BLOCKED || devices[d]?.status === DeviceStatus.FUSED) || '']?.name || '未知设备'} 异常`;
    }

    steps.push({
      deviceId: id,
      deviceName: dev.name,
      status: dev.status,
      reason,
      level,
    });

    const downstream = getDownstreamDevices(id, devices);
    for (const d of downstream) {
      traverse(d, level + 1, reason);
    }
  }

  traverse(faultDeviceId, 0);

  return {
    rootFaultId: faultDeviceId,
    rootFaultName: faultDevice?.name || '未知设备',
    faultCode: faultDevice?.faultCode || 'UNKNOWN',
    steps,
  };
}

export function getDevicesByStatus(
  devices: Record<string, Device>,
  statuses: DeviceStatus[]
): Device[] {
  return Object.values(devices).filter(d => statuses.includes(d.status));
}

export function getActiveDevices(devices: Record<string, Device>): Device[] {
  return getDevicesByStatus(devices, [DeviceStatus.ON, DeviceStatus.STANDBY, DeviceStatus.WARNING]);
}

export function countDevicesByStatus(devices: Record<string, Device>): Record<DeviceStatus, number> {
  const counts: Record<string, number> = {};
  for (const status of Object.values(DeviceStatus)) {
    counts[status] = 0;
  }
  for (const dev of Object.values(devices)) {
    counts[dev.status] = (counts[dev.status] || 0) + 1;
  }
  return counts as Record<DeviceStatus, number>;
}
