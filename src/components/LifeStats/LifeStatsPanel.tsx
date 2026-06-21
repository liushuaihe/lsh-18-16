import React, { useState } from 'react';
import { useMonitorStore } from '../../store/useMonitorStore';
import { LifeStats } from '../../types';
import { getHealthLevel } from '../../engine/lifeEngine';
import { Heart, Flame, Clock, RotateCcw, ShieldAlert, Activity } from 'lucide-react';

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m < 60) return `${m}m${sec}s`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h${min}m`;
}

function HealthBar({ score }: { score: number }) {
  const level = getHealthLevel(score);
  const barColor =
    level === 'good' ? 'bg-emerald-400' :
    level === 'warn' ? 'bg-amber-400' :
    'bg-rose-500';
  const glowColor =
    level === 'good' ? 'shadow-[0_0_8px_rgba(0,255,136,0.6)]' :
    level === 'warn' ? 'shadow-[0_0_8px_rgba(255,149,0,0.6)]' :
    'shadow-[0_0_8px_rgba(255,45,85,0.8)]';
  const textColor =
    level === 'good' ? 'text-emerald-400' :
    level === 'warn' ? 'text-amber-400' :
    'text-rose-400';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-800/80 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} ${glowColor} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold min-w-[36px] text-right ${textColor}`}>
        {score}
      </span>
    </div>
  );
}

function DeviceLifeCard({
  deviceId,
  lifeStats,
  isCore,
  onReset,
}: {
  deviceId: string;
  lifeStats: LifeStats;
  isCore: boolean;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const level = getHealthLevel(lifeStats.healthScore);
  const isLowHealth = lifeStats.healthScore < 60;

  const borderColor =
    level === 'good' ? 'border-emerald-500/30' :
    level === 'warn' ? 'border-amber-500/40' :
    'border-rose-500/60';
  const bgColor =
    level === 'good' ? 'bg-emerald-950/10' :
    level === 'warn' ? 'bg-amber-950/15' :
    'bg-rose-950/25';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-2.5 transition-all relative overflow-hidden`}>
      {isLowHealth && (
        <div className="absolute inset-0 pointer-events-none bg-rose-500/5 animate-pulse-led" />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Heart size={12} className={
              level === 'good' ? 'text-emerald-400' :
              level === 'warn' ? 'text-amber-400' :
              'text-rose-500 animate-blink-led'
            } />
            <span className="text-[11px] font-mono text-slate-300 truncate max-w-[120px]">
              {deviceId}
            </span>
            {isCore && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40">
                CORE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLowHealth && (
              <ShieldAlert size={12} className="text-rose-400 animate-blink-led" />
            )}
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-5 h-5 rounded text-[9px]
                  bg-slate-800/80 text-slate-500 border border-slate-600/40
                  hover:bg-emerald-900/40 hover:text-emerald-400 hover:border-emerald-500/50
                  flex items-center justify-center transition-all"
                title="重置寿命"
              >
                <RotateCcw size={9} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onReset(); setConfirmReset(false); }}
                  className="text-[8px] font-mono px-1 py-0.5 rounded bg-emerald-500/80 text-white"
                >
                  ✓
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-[8px] font-mono px-1 py-0.5 rounded bg-slate-700 text-slate-300"
                >
                  ✗
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mb-1.5">
          <HealthBar score={lifeStats.healthScore} />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1" title="运行时间">
            <Clock size={10} />
            {formatSeconds(lifeStats.runningSeconds)}
          </span>
          <span className="flex items-center gap-1" title="热冲击次数">
            <Flame size={10} className={lifeStats.thermalShocks > 0 ? 'text-amber-400' : ''} />
            {lifeStats.thermalShocks}
          </span>
        </div>
      </div>
    </div>
  );
}

export const LifeStatsPanel: React.FC = () => {
  const { devices, resetDeviceLife } = useMonitorStore();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warn' | 'good'>('all');

  const deviceList = Object.values(devices);

  const filtered = deviceList.filter(d => {
    const level = getHealthLevel(d.lifeStats.healthScore);
    if (filter === 'critical') return level === 'critical';
    if (filter === 'warn') return level === 'warn';
    if (filter === 'good') return level === 'good';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.lifeStats.healthScore - b.lifeStats.healthScore);

  const counts = {
    good: deviceList.filter(d => getHealthLevel(d.lifeStats.healthScore) === 'good').length,
    warn: deviceList.filter(d => getHealthLevel(d.lifeStats.healthScore) === 'warn').length,
    critical: deviceList.filter(d => getHealthLevel(d.lifeStats.healthScore) === 'critical').length,
  };

  const avgHealth = deviceList.length > 0
    ? Math.round(deviceList.reduce((s, d) => s + d.lifeStats.healthScore, 0) / deviceList.length * 10) / 10
    : 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-orbitron text-sm tracking-[0.2em] text-cyber-cyan neon-text-cyan flex items-center gap-2">
          <Activity size={16} />
          设备寿命损耗
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400">
            均值 {avgHealth}
          </span>
          {counts.critical > 0 && (
            <span className="px-2 py-1 rounded bg-rose-900/30 text-rose-400 border border-rose-500/40 text-[10px] font-mono animate-blink-led">
              {counts.critical} 低寿
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'good', 'warn', 'critical'] as const).map(f => {
          const active = filter === f;
          const label = f === 'all' ? '全部' : f === 'good' ? '良好' : f === 'warn' ? '警告' : '危险';
          const count = f === 'all' ? deviceList.length : counts[f];
          const style =
            f === 'good' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' :
            f === 'warn' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
            f === 'critical' ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' :
            '';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
                ${active
                  ? style || 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/50'
                  : 'bg-slate-800/50 text-slate-400 border-slate-600/50 hover:text-slate-200'
                }`}
            >
              {label} {count}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
        {sorted.map(d => (
          <DeviceLifeCard
            key={d.id}
            deviceId={d.id}
            lifeStats={d.lifeStats}
            isCore={d.isCore}
            onReset={() => resetDeviceLife(d.id)}
          />
        ))}
      </div>
    </div>
  );
};
