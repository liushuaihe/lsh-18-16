import React, { useState, useEffect } from 'react';
import { useMonitorStore } from '../../store/useMonitorStore';
import { DeviceStatus } from '../../types';
import {
  ShieldCheck, ShieldAlert, Cpu, ThermometerSun,
  AlertTriangle, Clock, Activity, Server,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const { devices, sensors, globalFuseActive, alerts } = useMonitorStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const onCount = Object.values(devices).filter(d =>
    d.status === DeviceStatus.ON || d.status === DeviceStatus.WARNING
  ).length;
  const standbyCount = Object.values(devices).filter(d =>
    d.status === DeviceStatus.STANDBY
  ).length;
  const totalCount = Object.keys(devices).length;
  const faultCount = Object.values(devices).filter(d =>
    d.status === DeviceStatus.FAULT || d.status === DeviceStatus.FUSED
  ).length;
  const blockedCount = Object.values(devices).filter(d =>
    d.status === DeviceStatus.BLOCKED
  ).length;
  const warnCount = alerts.filter(a => !a.acknowledged && a.level === 'warning').length;
  const critCount = alerts.filter(a => !a.acknowledged && (a.level === 'critical' || a.level === 'fuse')).length;

  const avgTemp = Object.values(sensors).reduce((s, x) => s + x.currentTemp, 0)
    / Math.max(1, Object.keys(sensors).length);

  const powerKW = Object.values(devices).filter(d =>
    d.status === DeviceStatus.ON || d.status === DeviceStatus.WARNING
  ).reduce((s, d) => s + d.powerConsumption, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(time.getHours());
  const mm = pad(time.getMinutes());
  const ss = pad(time.getSeconds());
  const yy = time.getFullYear();
  const mo = pad(time.getMonth() + 1);
  const dd = pad(time.getDate());

  return (
    <div className={`relative w-full h-14 flex items-center px-4 gap-3 border-b
      ${globalFuseActive
        ? 'bg-gradient-to-r from-red-950 via-rose-900/40 to-red-950 border-red-500/60'
        : 'bg-gradient-to-r from-cyber-panel via-cyber-card to-cyber-panel border-cyber-line'
      }
    `}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border-2
            ${globalFuseActive
              ? 'bg-red-900/60 border-red-500 animate-blink-led'
              : 'bg-cyber-cyan/10 border-cyber-cyan/60'
            }`}>
            {globalFuseActive
              ? <ShieldAlert size={18} className="text-red-400" />
              : <Server size={18} className="text-cyber-cyan" />
            }
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
            bg-emerald-400 border-2 border-cyber-panel animate-pulse-led
            shadow-[0_0_8px_rgba(0,255,136,0.8)]" />
        </div>
        <div>
          <div className="font-orbitron text-sm tracking-[0.25em] text-cyber-cyan neon-text-cyan leading-tight">
            CYBER·WORKSHOP
          </div>
          <div className="text-[10px] font-mono text-slate-500 tracking-wider">
            MONITOR CONSOLE v2.077 · INDUSTRIAL IOT
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap">
        <StatChip
          icon={<Cpu size={11} />}
          label="在线"
          value={`${onCount}/${totalCount}`}
          sub={`${standbyCount}待`}
          color="cyan"
        />
        <Divider />
        <StatChip
          icon={<ShieldCheck size={11} />}
          label="负载"
          value={`${powerKW}kW`}
          color={powerKW > 60 ? 'amber' : 'cyan'}
        />
        <Divider />
        <StatChip
          icon={<ThermometerSun size={11} />}
          label="平均温度"
          value={`${avgTemp.toFixed(1)}°C`}
          color={avgTemp > 45 ? 'amber' : avgTemp > 60 ? 'red' : 'cyan'}
        />
        <Divider />
        <StatChip
          icon={<AlertTriangle size={11} />}
          label="报警"
          value={`${warnCount + critCount}`}
          sub={`${critCount}严重`}
          color={critCount > 0 ? 'red' : warnCount > 0 ? 'amber' : 'cyan'}
          blink={critCount > 0}
        />
        {faultCount > 0 && (
          <>
            <Divider />
            <StatChip
              icon={<ShieldAlert size={11} />}
              label="故障"
              value={`${faultCount}`}
              sub={`${blockedCount}阻断`}
              color="red"
              blink
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-orbitron text-base tracking-[0.15em] text-cyber-cyan neon-text-cyan leading-none">
            {hh}<span className="animate-blink-led">:</span>{mm}<span className="animate-blink-led">:</span>{ss}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1 justify-end">
            <Clock size={10} />
            {yy}-{mo}-{dd}
            <span className="ml-1 text-emerald-500/70 flex items-center gap-0.5">
              <Activity size={9} className="animate-pulse-led" />
              LIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Divider: React.FC = () => (
  <div className="w-px h-6 bg-gradient-to-b from-transparent via-cyber-cyan/30 to-transparent" />
);

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: 'cyan' | 'amber' | 'red';
  blink?: boolean;
}

const StatChip: React.FC<StatProps> = ({ icon, label, value, sub, color, blink }) => {
  const cmap = {
    cyan: 'text-cyber-cyan border-cyber-cyan/30 bg-cyber-cyan/5',
    amber: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    red: 'text-rose-400 border-rose-500/50 bg-rose-500/10',
  };
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md border ${cmap[color]}`}>
      <span className={`${blink ? 'animate-blink-led' : ''}`}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</div>
        <div className={`text-[12px] font-orbitron font-bold ${blink ? 'animate-blink-led' : ''}`}>
          {value}
          {sub && <span className="text-[10px] opacity-70 ml-1 font-mono">{sub}</span>}
        </div>
      </div>
    </div>
  );
};
