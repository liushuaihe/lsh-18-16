import React, { useEffect, useRef } from 'react';
import { TempSensor, SensorAlertLevel } from '../../types';

interface Props {
  sensors: Array<{
    sensor: TempSensor;
    deviceName: string;
    color: string;
  }>;
  height?: number;
  windowMs?: number;
}

const COLORS_BY_LEVEL: Record<SensorAlertLevel, string> = {
  normal: '#00F0FF',
  warning: '#FF9500',
  critical: '#FF2D55',
  fuse: '#FF0040',
};

export const TempChart: React.FC<Props> = ({ sensors, height = 220, windowMs = 60_000 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>();
  const sensorsRef = useRef(sensors);
  sensorsRef.current = sensors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = height;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const padding = { top: 16, right: 56, bottom: 22, left: 8 };
      const plotW = w - padding.left - padding.right;
      const plotH = h - padding.top - padding.bottom;

      const currSensors = sensorsRef.current;
      const now = Date.now();
      const tMin = now - windowMs;

      let tempMin = Infinity;
      let tempMax = -Infinity;
      for (const { sensor } of currSensors) {
        if (sensor.fuseThreshold > tempMax) tempMax = sensor.fuseThreshold;
        if (sensor.baseTemp < tempMin) tempMin = sensor.baseTemp;
        for (const p of sensor.tempHistory) {
          if (p.v < tempMin) tempMin = p.v;
          if (p.v > tempMax) tempMax = p.v;
        }
        if (sensor.currentTemp < tempMin) tempMin = sensor.currentTemp;
        if (sensor.currentTemp > tempMax) tempMax = sensor.currentTemp;
      }
      if (!isFinite(tempMin)) { tempMin = 20; tempMax = 100; }
      tempMin = Math.floor(tempMin - 5);
      tempMax = Math.ceil(tempMax + 5);

      const tRange = tempMax - tempMin;
      const x = (t: number) => padding.left + ((t - tMin) / windowMs) * plotW;
      const y = (v: number) => padding.top + (1 - (v - tempMin) / tRange) * plotH;

      // Grid
      ctx.strokeStyle = 'rgba(0,240,255,0.08)';
      ctx.lineWidth = 1;
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const gy = padding.top + (i / gridLines) * plotH;
        ctx.beginPath();
        ctx.moveTo(padding.left, gy);
        ctx.lineTo(padding.left + plotW, gy);
        ctx.stroke();
        const val = tempMax - (i / gridLines) * tRange;
        ctx.fillStyle = 'rgba(138,155,179,0.5)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${val.toFixed(0)}°`, padding.left + plotW + 4, gy);
      }

      // Vertical grid
      for (let i = 0; i <= 6; i++) {
        const gx = padding.left + (i / 6) * plotW;
        ctx.strokeStyle = 'rgba(0,240,255,0.04)';
        ctx.beginPath();
        ctx.moveTo(gx, padding.top);
        ctx.lineTo(gx, padding.top + plotH);
        ctx.stroke();
      }

      // Threshold lines (use first sensor's thresholds as reference)
      if (currSensors.length > 0) {
        const ref = currSensors[0].sensor;
        const drawThr = (val: number, color: string, label: string, dash = [4, 4]) => {
          const yy = y(val);
          if (yy < padding.top || yy > padding.top + plotH) return;
          ctx.save();
          ctx.setLineDash(dash);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding.left, yy);
          ctx.lineTo(padding.left + plotW, yy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.globalAlpha = 0.8;
          ctx.fillText(`${label} ${val.toFixed(0)}°`, padding.left + 4, yy - 2);
          ctx.restore();
        };
        drawThr(ref.warningThreshold, 'rgba(255,149,0,0.7)', '⚠');
        drawThr(ref.criticalThreshold, 'rgba(255,45,85,0.8)', '⚠⚠');
        drawThr(ref.fuseThreshold, 'rgba(255,0,80,0.9)', 'FUSE', [2, 3]);
      }

      // Plot each sensor
      for (const { sensor, color } of currSensors) {
        if (!sensor.tempHistory.length && sensor.currentTemp == null) continue;
        const lineColor = COLORS_BY_LEVEL[sensor.alertLevel] || color;

        const allPoints = [
          ...sensor.tempHistory,
          { t: now, v: sensor.currentTemp },
        ].filter(p => p.t >= tMin);

        if (allPoints.length < 2) {
          const px = x(now);
          const py = y(sensor.currentTemp);
          ctx.fillStyle = lineColor;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Gradient fill under curve
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
        grad.addColorStop(0, lineColor + '40');
        grad.addColorStop(1, lineColor + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x(allPoints[0].t), y(allPoints[0].v));
        for (let i = 1; i < allPoints.length; i++) {
          ctx.lineTo(x(allPoints[i].t), y(allPoints[i].v));
        }
        const lastX = x(allPoints[allPoints.length - 1].t);
        ctx.lineTo(lastX, padding.top + plotH);
        ctx.lineTo(x(allPoints[0].t), padding.top + plotH);
        ctx.closePath();
        ctx.fill();

        // Line
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x(allPoints[0].t), y(allPoints[0].v));
        for (let i = 1; i < allPoints.length; i++) {
          const p = allPoints[i];
          const prev = allPoints[i - 1];
          const cpx = x(prev.t) + (x(p.t) - x(prev.t)) * 0.5;
          ctx.bezierCurveTo(cpx, y(prev.v), cpx, y(p.v), x(p.t), y(p.v));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Endpoint glow dot
        const last = allPoints[allPoints.length - 1];
        const ex = x(last.t);
        const ey = y(last.v);
        const pulse = (Math.sin(now / 200) + 1) / 2;
        ctx.fillStyle = lineColor;
        ctx.globalAlpha = 0.3 + pulse * 0.4;
        ctx.beginPath();
        ctx.arc(ex, ey, 7 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Value label
        ctx.fillStyle = lineColor;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${sensor.currentTemp.toFixed(1)}°`, ex + 6, ey);
        ctx.shadowBlur = 0;
      }

      // X axis time labels
      ctx.fillStyle = 'rgba(138,155,179,0.5)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= 6; i++) {
        const t = tMin + (i / 6) * windowMs;
        const secs = Math.floor((now - t) / 1000);
        const label = secs === 0 ? 'now' : `-${secs}s`;
        const gx = padding.left + (i / 6) * plotW;
        ctx.fillText(label, gx, padding.top + plotH + 6);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [height, windowMs]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
};
