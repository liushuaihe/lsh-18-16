import React, { useState, useEffect } from 'react';
import { Device, DeviceStatus, ToggleResult, STATUS_COLORS } from '../../types';
import { DeviceLed } from './DeviceLed';
import { getHealthLevel } from '../../engine/lifeEngine';
import { Zap, AlertTriangle, Lock, Link, Power, Cpu, Heart, Flame } from 'lucide-react';

interface Props {
  device: Device;
  toggle: (id: string) => ToggleResult;
  startChain: (id: string) => ToggleResult;
  onShowDeps: (id: string) => void;
  highlight?: boolean;
  flashType?: 'fault' | 'fuse' | null;
}

export const DeviceToggle: React.FC<Props> = ({
  device,
  toggle,
  startChain,
  onShowDeps,
  highlight,
  flashType,
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const colors = STATUS_COLORS[device.status];
  const isOn =
    device.status === DeviceStatus.ON ||
    device.status === DeviceStatus.STANDBY ||
    device.status === DeviceStatus.WARNING;
  const isDisabled =
    device.status === DeviceStatus.FAULT ||
    device.status === DeviceStatus.FUSED;
  const isBlocked = device.status === DeviceStatus.BLOCKED;

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2800);
  };

  const handleToggle = () => {
    if (isDisabled) {
      showMsg(`设备已${device.status === DeviceStatus.FAULT ? '故障' : '熔断'}，请先复位`);
      setShakeKey(k => k + 1);
      return;
    }
    const r = toggle(device.id);
    if (!r.success) {
      showMsg(r.message || '操作失败');
      setShakeKey(k => k + 1);
    }
  };

  const handleChain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOn) return;
    const r = startChain(device.id);
    showMsg(r.message || (r.success ? '启动依赖链...' : '失败'));
    if (!r.success) setShakeKey(k => k + 1);
  };

  const canShowChainButton =
    !isOn && !isDisabled && device.dependencyIds.length > 0;
  const isLowHealth = device.lifeStats.healthScore < 60;

  useEffect(() => {
    if (flashType) setShakeKey(k => k + 1);
  }, [flashType]);

  return (
    <div
      key={shakeKey}
      className={`
        relative rounded-lg p-3 transition-all duration-300
        ${colors.bg} ${colors.border} border
        ${highlight ? 'ring-2 ring-cyber-cyan shadow-neon-cyan scale-[1.02]' : 'shadow-neon-inset'}
        ${isDisabled ? 'opacity-80' : ''}
        ${flashType === 'fault' ? 'flash-fault screen-shake' : ''}
        ${flashType === 'fuse' ? 'flash-fuse screen-shake' : ''}
        ${isBlocked ? 'border-dashed' : ''}
        hover:shadow-neon-cyan hover:brightness-110
        group
      `}
    >
      <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rod-trace" />
      </div>

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <DeviceLed status={device.status} size="md" showPulseRing />
            <span className={`text-xs font-mono tracking-wider uppercase ${colors.text}`}>
              {device.id}
            </span>
            {device.isCore && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40">
                <Cpu size={10} /> CORE
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-slate-200 truncate mb-1">
            {device.name}
          </div>
          <div className="barcode mb-2 rounded-sm" />
          <div className="flex items-center justify-between text-[11px]">
            <span className={`font-mono ${colors.text}`}>
              {device.status === DeviceStatus.BLOCKED
                ? device.blockReason
                  ? device.blockReason.length > 24
                    ? device.blockReason.slice(0, 22) + '..'
                    : device.blockReason
                  : '依赖阻断'
                : null}
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1" title={`健康分: ${device.lifeStats.healthScore} | 热冲击: ${device.lifeStats.thermalShocks}`}>
                <Heart size={10} className={
                  getHealthLevel(device.lifeStats.healthScore) === 'good' ? 'text-emerald-400' :
                  getHealthLevel(device.lifeStats.healthScore) === 'warn' ? 'text-amber-400' :
                  'text-rose-500'
                } />
                <span className={
                  getHealthLevel(device.lifeStats.healthScore) === 'good' ? 'text-emerald-400' :
                  getHealthLevel(device.lifeStats.healthScore) === 'warn' ? 'text-amber-400' :
                  'text-rose-500'
                }>
                  {device.lifeStats.healthScore}
                </span>
                {device.lifeStats.thermalShocks > 0 && (
                  <Flame size={9} className="text-amber-400" />
                )}
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <Zap size={10} />
                {device.powerConsumption}kW
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className={`toggle-switch w-12 h-20 rounded-lg relative
              ${isOn ? 'bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 border-emerald-500/60' : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-600/60'}
              border
              ${!isOn && !isDisabled && !isBlocked ? 'hover:border-cyber-cyan/50 hover:shadow-inner' : ''}
              ${isDisabled ? 'cursor-not-allowed' : ''}
            `}
            onClick={handleToggle}
            title={isDisabled ? '设备需要复位' : isOn ? '点击关闭' : '点击启动'}
          >
            <div className="absolute inset-x-0 top-0 h-6 border-b border-black/30 flex items-center justify-center text-[9px] text-emerald-400/80 font-mono">
              ON
            </div>
            <div className="absolute inset-x-0 bottom-0 h-6 border-t border-black/30 flex items-center justify-center text-[9px] text-slate-500 font-mono">
              OFF
            </div>
            <div
              className={`toggle-knob absolute left-1 right-1 h-10 rounded-md
                ${isOn ? 'top-1' : 'bottom-1'}
                ${isOn
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(0,255,136,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]'
                  : 'bg-gradient-to-b from-slate-500 to-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                }
                ${isDisabled ? 'from-rose-700 to-rose-900' : ''}
              `}
            >
              <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-white/20" />
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                <div className={`h-0.5 rounded ${isOn ? 'bg-emerald-900/60' : 'bg-black/40'}`} />
                <div className={`h-0.5 rounded ${isOn ? 'bg-emerald-900/60' : 'bg-black/40'}`} />
                <div className={`h-0.5 rounded ${isOn ? 'bg-emerald-900/60' : 'bg-black/40'}`} />
              </div>
            </div>
            {isDisabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock size={14} className="text-rose-400" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {canShowChainButton && (
              <button
                onClick={handleChain}
                className={`flex items-center justify-center gap-1 w-12 h-7 rounded text-[10px] font-mono transition-all
                  ${isLowHealth
                    ? 'bg-rose-900/20 text-rose-500/60 border border-rose-500/30 cursor-not-allowed'
                    : 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/20 hover:shadow-neon-cyan'
                  }`}
                title={isLowHealth ? `健康分 ${device.lifeStats.healthScore} 低于60，限制链启` : '一键启动依赖链'}
              >
                <Power size={11} />
                链启
              </button>
            )}
            {device.dependencyIds.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onShowDeps(device.id); }}
                className="flex items-center justify-center gap-1 w-12 h-7 rounded text-[10px] font-mono
                  bg-slate-700/40 text-slate-300 border border-slate-600/50
                  hover:bg-slate-700/60 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-all"
                title="查看依赖关系"
              >
                <Link size={11} />
                依赖
              </button>
            )}
            {message && (
              <div className="absolute top-full mt-2 left-0 right-0 z-50">
                <div className={`text-[11px] px-2 py-1.5 rounded border font-mono whitespace-normal leading-tight
                  ${r_isError(message)
                    ? 'bg-rose-950/90 text-rose-300 border-rose-600/60 shadow-neon-red'
                    : 'bg-cyan-950/90 text-cyan-200 border-cyber-cyan/50 shadow-neon-cyan'
                  }`}>
                  {r_isError(message) && <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />}
                  {message}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function r_isError(msg: string): boolean {
  return msg.includes('失败') || msg.includes('未就绪') || msg.includes('阻断') || msg.includes('请先') || msg.includes('熔断') || msg.includes('故障') || msg.includes('低于60') || msg.includes('禁止启动') || msg.includes('限制链启');
}
