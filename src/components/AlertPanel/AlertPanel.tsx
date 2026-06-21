import React, { useState } from 'react';
import { Alert, AlertLevel, DeviceStatus } from '../../types';
import { useMonitorStore } from '../../store/useMonitorStore';
import {
  AlertTriangle, AlertOctagon, Flame, CheckCircle,
  ChevronDown, ChevronRight, Zap, X,
} from 'lucide-react';

interface Props {
  alerts: Alert[];
}

const LEVEL_STYLE: Record<AlertLevel, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  text: string;
  label: string;
  badge: string;
}> = {
  warning: {
    icon: <AlertTriangle size={14} />,
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
    label: '警示',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  },
  critical: {
    icon: <AlertOctagon size={14} />,
    bg: 'bg-rose-950/50',
    border: 'border-rose-500/60',
    text: 'text-rose-300',
    label: '严重',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/60',
  },
  fuse: {
    icon: <Flame size={14} />,
    bg: 'bg-red-950/60',
    border: 'border-red-500/70',
    text: 'text-red-300',
    label: '熔断',
    badge: 'bg-red-500/30 text-red-300 border-red-500/70 animate-blink-led',
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export const AlertPanel: React.FC<Props> = ({ alerts }) => {
  const acknowledgeAlert = useMonitorStore(s => s.acknowledgeAlert);
  const [filter, setFilter] = useState<'all' | AlertLevel>('all');
  const [onlyUnread, setOnlyUnread] = useState(true);

  const filtered = alerts.filter(a => {
    if (filter !== 'all' && a.level !== filter) return false;
    if (onlyUnread && a.acknowledged) return false;
    return true;
  });

  const counts = {
    warning: alerts.filter(a => a.level === 'warning' && !a.acknowledged).length,
    critical: alerts.filter(a => a.level === 'critical' && !a.acknowledged).length,
    fuse: alerts.filter(a => a.level === 'fuse' && !a.acknowledged).length,
  };

  return (
    <div className="rounded-lg border border-cyber-line bg-cyber-panel/70 p-3 relative overflow-hidden hud-corner">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-orbitron text-xs tracking-[0.15em] text-cyber-cyan neon-text-cyan">
            报警日志
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {alerts.length} TOTAL · {filtered.length} DISPLAY
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setOnlyUnread(v => !v)}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
              ${onlyUnread
                ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/50'
                : 'bg-slate-800/50 text-slate-400 border-slate-600/50 hover:text-slate-200'
              }`}
          >
            {onlyUnread ? '仅未确认' : '全部显示'}
          </button>
          {(['all', 'warning', 'critical', 'fuse'] as const).map(lv => {
            const active = filter === lv;
            const style = lv !== 'all' ? LEVEL_STYLE[lv] : null;
            return (
              <button
                key={lv}
                onClick={() => setFilter(lv)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
                  ${active
                    ? style
                      ? `${style.badge} shadow-neon-amber`
                      : 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/50'
                    : 'bg-slate-800/50 text-slate-400 border-slate-600/50 hover:text-slate-200'
                  }`}
              >
                {lv === 'all' ? `全部 ${alerts.length}` :
                  `${style?.label || lv} ${counts[lv]}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-500 text-sm font-mono">
            <CheckCircle size={32} className="inline-block text-emerald-500/60 mb-2" />
            <div>暂无报警</div>
            <div className="text-[10px] mt-1">系统状态正常</div>
          </div>
        )}
        {filtered.map(a => {
          const style = LEVEL_STYLE[a.level];
          const state = useMonitorStore.getState();
          const dev = state.devices[a.deviceId];
          return (
            <div
              key={a.id}
              className={`relative rounded border ${style.border} ${style.bg} p-2.5 transition-all
                ${a.acknowledged ? 'opacity-60' : ''}
                ${a.level === 'fuse' ? 'shadow-neon-red animate-pulse-led' : ''}
                ${a.level === 'critical' && !a.acknowledged ? 'shadow-neon-red' : ''}
                ${a.level === 'warning' && !a.acknowledged ? 'shadow-neon-amber' : ''}
                group
              `}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 ${style.text}`}>{style.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] font-mono text-cyber-grey">
                      {formatTime(a.timestamp)}
                    </span>
                    {a.deviceId !== 'SYSTEM' && dev && (
                      <span className="text-[10px] font-mono text-cyber-cyan/70">
                        {a.deviceId}
                      </span>
                    )}
                    {a.temperature != null && (
                      <span className={`text-[10px] font-mono ${style.text}`}>
                        {a.temperature.toFixed(1)}°C
                        {a.threshold != null && (
                          <span className="text-slate-500"> / {a.threshold.toFixed(0)}°C</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 leading-snug ${a.acknowledged ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                    {a.message}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!a.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(a.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity
                        text-[10px] font-mono px-1.5 py-0.5 rounded
                        bg-emerald-900/30 text-emerald-400 border border-emerald-500/40
                        hover:bg-emerald-900/50 flex items-center gap-0.5"
                      title="确认报警"
                    >
                      <CheckCircle size={10} />
                      确认
                    </button>
                  )}
                  {a.acknowledged && (
                    <span className="text-[10px] font-mono text-emerald-500/70 flex items-center gap-0.5">
                      <CheckCircle size={10} /> 已确认
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
