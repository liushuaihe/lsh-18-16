import React from 'react';
import { DeviceStatus, STATUS_COLORS } from '../../types';

interface Props {
  status: DeviceStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulseRing?: boolean;
}

export const DeviceLed: React.FC<Props> = ({ status, size = 'md', showPulseRing = false }) => {
  const colors = STATUS_COLORS[status];
  const sizeMap = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  const isBlinking =
    status === DeviceStatus.FAULT ||
    status === DeviceStatus.FUSED ||
    status === DeviceStatus.WARNING;
  const isBreathing = status === DeviceStatus.STANDBY || status === DeviceStatus.BLOCKED;
  const isPulseFault = status === DeviceStatus.FAULT || status === DeviceStatus.FUSED;

  return (
    <div className={`relative inline-flex items-center justify-center`}>
      {showPulseRing && isPulseFault && (
        <>
          <div
            className={`pulse-ring ${sizeMap[size]}`}
            style={{ animationDelay: '0s' }}
          />
          <div
            className={`pulse-ring ${sizeMap[size]}`}
            style={{ animationDelay: '0.4s' }}
          />
        </>
      )}
      <div
        className={`${sizeMap[size]} rounded-full ${colors.dot}
          ${isBlinking ? 'animate-blink-led' : ''}
          ${isBreathing ? 'animate-pulse-led' : ''}
          ${status === DeviceStatus.ON ? 'shadow-[0_0_8px_rgba(0,255,136,0.8)]' : ''}
          ${status === DeviceStatus.WARNING ? 'shadow-[0_0_8px_rgba(255,149,0,0.8)]' : ''}
          ${isPulseFault ? 'shadow-[0_0_10px_rgba(255,45,85,0.9)]' : ''}
          ${status === DeviceStatus.STANDBY ? 'shadow-[0_0_6px_rgba(251,191,36,0.7)]' : ''}
        `}
      />
    </div>
  );
};
