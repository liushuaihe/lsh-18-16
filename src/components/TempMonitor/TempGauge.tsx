import React, { useEffect, useRef } from 'react';
import { TempSensor, SensorAlertLevel } from '../../types';

interface Props {
  sensor: TempSensor;
  deviceName: string;
  deviceId: string;
}

const LEVEL_COLOR: Record<SensorAlertLevel, string> = {
  normal: '#00F0FF',
  warning: '#FF9500',
  critical: '#FF2D55',
  fuse: '#FF0040',
};

const LEVEL_TEXT: Record<SensorAlertLevel, string> = {
  normal: '正常',
  warning: '警示',
  critical: '严重',
  fuse: '熔断',
};

export const TempGauge: React.FC<Props> = ({ sensor, deviceName, deviceId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef(sensor.currentTemp);
  const displayRef = useRef(sensor.currentTemp);
  const rafRef = useRef<number>();
  targetRef.current = sensor.currentTemp;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Smooth temperature
      displayRef.current += (targetRef.current - displayRef.current) * 0.15;
      const temp = displayRef.current;

      const cx = w / 2;
      const cy = h * 0.55;
      const radius = Math.min(cx, cy) - 8;

      const startAngle = Math.PI * 0.75;
      const endAngle = Math.PI * 2.25;
      const totalAngle = endAngle - startAngle;

      const minVal = Math.min(sensor.baseTemp - 5, 20);
      const maxVal = sensor.fuseThreshold + 5;
      const range = maxVal - minVal;
      const pct = Math.max(0, Math.min(1, (temp - minVal) / range));
      const curAngle = startAngle + pct * totalAngle;

      // Background arc
      ctx.strokeStyle = 'rgba(0,240,255,0.12)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.stroke();

      // Warning band
      const warnPct = Math.max(0, Math.min(1, (sensor.warningThreshold - minVal) / range));
      const critPct = Math.max(0, Math.min(1, (sensor.criticalThreshold - minVal) / range));
      const fusePct = Math.max(0, Math.min(1, (sensor.fuseThreshold - minVal) / range));
      const angleAt = (p: number) => startAngle + p * totalAngle;

      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(255,149,0,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angleAt(warnPct), angleAt(critPct));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,45,85,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angleAt(critPct), angleAt(fusePct));
      ctx.stroke();

      // Value arc
      const color = LEVEL_COLOR[sensor.alertLevel];
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, curAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Threshold ticks
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,149,0,0.9)';
      ctx.beginPath();
      const tx1 = angleAt(warnPct);
      ctx.moveTo(cx + Math.cos(tx1) * (radius - 6), cy + Math.sin(tx1) * (radius - 6));
      ctx.lineTo(cx + Math.cos(tx1) * (radius + 6), cy + Math.sin(tx1) * (radius + 6));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,45,85,0.9)';
      const tx2 = angleAt(critPct);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tx2) * (radius - 6), cy + Math.sin(tx2) * (radius - 6));
      ctx.lineTo(cx + Math.cos(tx2) * (radius + 6), cy + Math.sin(tx2) * (radius + 6));
      ctx.stroke();

      // Needle tip
      const nx = cx + Math.cos(curAngle) * (radius + 2);
      const ny = cy + Math.sin(curAngle) * (radius + 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center text: temp value
      ctx.fillStyle = color;
      ctx.font = 'bold 22px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillText(`${temp.toFixed(1)}°`, cx, cy - 6);
      ctx.shadowBlur = 0;

      // Subtext: unit
      ctx.fillStyle = 'rgba(138,155,179,0.7)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`目标 ${sensor.targetTemp.toFixed(0)}°C`, cx, cy + 14);

      // Status
      ctx.fillStyle = color;
      ctx.font = 'bold 9px Orbitron, sans-serif';
      ctx.fillText(LEVEL_TEXT[sensor.alertLevel].toUpperCase(), cx, cy + radius + 12);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sensor]);

  return (
    <div className={`rounded-lg p-2 bg-cyber-card/60 border
      ${sensor.alertLevel === 'fuse' ? 'border-red-500/70 shadow-neon-red' :
        sensor.alertLevel === 'critical' ? 'border-rose-500/50' :
          sensor.alertLevel === 'warning' ? 'border-amber-500/50' :
            'border-cyber-cyan/20'
      }
      relative overflow-hidden hud-corner
    `}>
      <div className="flex items-center justify-between mb-1 px-1">
        <div>
          <div className="text-[10px] font-mono text-cyber-grey/80">{deviceId}</div>
          <div className="text-xs text-slate-200 truncate max-w-[110px]">{deviceName}</div>
        </div>
        <div className="text-right text-[10px] font-mono space-y-0.5">
          <div className="text-amber-400/90">⚠ {sensor.warningThreshold.toFixed(0)}°</div>
          <div className="text-rose-400/90">!! {sensor.criticalThreshold.toFixed(0)}°</div>
          <div className="text-red-500">F {sensor.fuseThreshold.toFixed(0)}°</div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '110px', display: 'block' }} />
    </div>
  );
};
