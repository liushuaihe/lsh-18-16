import { Device, DeviceStatus } from '../types';

type TransitionAction =
  | { type: 'TURN_ON' }
  | { type: 'SELF_CHECK_DONE' }
  | { type: 'TURN_OFF' }
  | { type: 'TEMP_WARNING' }
  | { type: 'TEMP_NORMAL' }
  | { type: 'TEMP_CRITICAL' }
  | { type: 'FAULT'; faultCode: string }
  | { type: 'FUSE' }
  | { type: 'BLOCK'; reason: string }
  | { type: 'UNBLOCK' }
  | { type: 'RESET_FAULT' };

interface Transition {
  from: DeviceStatus | DeviceStatus[];
  to: DeviceStatus;
  action: TransitionAction['type'];
  condition?: (device: Device) => boolean;
}

const TRANSITIONS: Transition[] = [
  { from: DeviceStatus.OFF, to: DeviceStatus.STANDBY, action: 'TURN_ON' },
  { from: DeviceStatus.STANDBY, to: DeviceStatus.ON, action: 'SELF_CHECK_DONE' },
  { from: [DeviceStatus.STANDBY, DeviceStatus.ON, DeviceStatus.WARNING], to: DeviceStatus.OFF, action: 'TURN_OFF' },
  { from: DeviceStatus.ON, to: DeviceStatus.WARNING, action: 'TEMP_WARNING' },
  { from: DeviceStatus.WARNING, to: DeviceStatus.ON, action: 'TEMP_NORMAL' },
  { from: [DeviceStatus.WARNING, DeviceStatus.ON], to: DeviceStatus.FAULT, action: 'TEMP_CRITICAL' },
  { from: [DeviceStatus.ON, DeviceStatus.WARNING, DeviceStatus.STANDBY], to: DeviceStatus.FAULT, action: 'FAULT' },
  { from: [DeviceStatus.ON, DeviceStatus.WARNING, DeviceStatus.FAULT], to: DeviceStatus.FUSED, action: 'FUSE' },
  { from: [DeviceStatus.OFF, DeviceStatus.BLOCKED], to: DeviceStatus.BLOCKED, action: 'BLOCK' },
  { from: DeviceStatus.BLOCKED, to: DeviceStatus.OFF, action: 'UNBLOCK' },
  { from: [DeviceStatus.FAULT, DeviceStatus.FUSED], to: DeviceStatus.OFF, action: 'RESET_FAULT' },
];

export function canTransition(
  currentStatus: DeviceStatus,
  actionType: TransitionAction['type']
): DeviceStatus | null {
  for (const t of TRANSITIONS) {
    const fromMatch = Array.isArray(t.from)
      ? t.from.includes(currentStatus)
      : t.from === currentStatus;
    if (fromMatch && t.action === actionType) {
      return t.to;
    }
  }
  return null;
}

export function applyTransition(
  device: Device,
  action: TransitionAction
): Device | null {
  const nextStatus = canTransition(device.status, action.type);
  if (!nextStatus) return null;

  const updated: Device = {
    ...device,
    status: nextStatus,
    lastStatusChange: Date.now(),
  };

  if (action.type === 'FAULT' && 'faultCode' in action) {
    updated.faultCode = action.faultCode;
  }
  if (action.type === 'BLOCK' && 'reason' in action) {
    updated.blockReason = action.reason;
  }
  if (action.type === 'UNBLOCK' || action.type === 'RESET_FAULT') {
    updated.faultCode = undefined;
    updated.blockReason = undefined;
  }

  return updated;
}

export function isDeviceRunning(status: DeviceStatus): boolean {
  return status === DeviceStatus.ON || status === DeviceStatus.WARNING || status === DeviceStatus.STANDBY;
}

export function isDeviceProblematic(status: DeviceStatus): boolean {
  return status === DeviceStatus.FAULT || status === DeviceStatus.WARNING || status === DeviceStatus.FUSED;
}

export function isDeviceDisabled(status: DeviceStatus): boolean {
  return status === DeviceStatus.FAULT || status === DeviceStatus.FUSED || status === DeviceStatus.BLOCKED;
}
