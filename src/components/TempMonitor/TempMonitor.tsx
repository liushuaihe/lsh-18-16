import React, { useState } from 'react';
import { useMonitorStore } from '../../store/useMonitorStore';
import { DeviceStatus } from '../../types';
import { TempChart } from './TempChart';
import { TempGauge } from './TempGauge';
import { Thermometer, Activity, Filter } from 'lucide-react';

const SENSOR_COLORS = [
  '#00F0FF', '#00FF88', '#FFD60A', '#AF52DE',
  '#FF9500', '#64D2FF', '#FF2D55', '#30D158',
];

export const TempMonitor: React.FC = () => {
  const { devices, sensors } = useMonitorStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const allSensorList = Object.values(sensors)
    .map(s => ({ sensor: s, device: devices[s.deviceId] }))
    .filter(x => !!x.device)
    .sort((a, b) => {
      const statusOrder = [
        DeviceStatus.FUSED, DeviceStatus.FAULT, DeviceStatus.WARNING,
        DeviceStatus.ON, DeviceStatus.STANDBY, DeviceStatus.BLOCKED, DeviceStatus.OFF,
      ];
      return statusOrder.indexOf(a.device!.status) - statusOrder.indexOf(b.device!.status);
    });

  const runningSensors = allSensorList.filter(x =>
    x.device!.status === DeviceStatus.ON ||
    x.device!.status === DeviceStatus.WARNING ||
    x.device!.status === DeviceStatus.STANDBY ||
    x.device!.status === DeviceStatus.FAULT
  );

  const displaySensors = showAll ? allSensorList : runningSensors;

  const chartData = (selectedIds.length > 0
    ? allSensorList.filter(x => selectedIds.includes(x.sensor.id))
    : displaySensors
  ).slice(0, 6).map((x, i) => ({
    sensor: x.sensor,
    deviceName: x.device!.name,
    color: SENSOR_COLORS[i % SENSOR_COLORS.length],
  }));

  const problematicSensors = allSensorList.filter(x =>
    x.sensor.alertLevel === 'warning' ||
    x.sensor.alertLevel === 'critical' ||
    x.sensor.alertLevel === 'fuse'
  );

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-orbitron text-sm tracking-[0.2em] text-cyber-cyan neon-text-cyan flex items-center gap-2">
          <Thermometer size={16} />
          温控实时监控
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(v => !v)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-all
              ${showAll
                ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/50'
                : 'bg-slate-800/50 text-slate-400 border-slate-600/50 hover:text-cyber-cyan'
              }`}
          >
            <Filter size={11} />
            {showAll ? '显示全部' : '仅运行中'}
          </button>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="px-2 py-1 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-500/40">
              {allSensorList.filter(x => x.sensor.alertLevel === 'normal').length} 正常
            </span>
            {problematicSensors.length > 0 && (
              <span className="px-2 py-1 rounded bg-rose-900/30 text-rose-400 border border-rose-500/40 animate-blink-led">
                {problematicSensors.length} 异常
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="rounded-lg border border-cyber-line bg-cyber-panel/70 p-3 relative overflow-hidden hud-corner">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-grid-cyber" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyber-grey">
            <Activity size={12} className="text-cyber-cyan" />
            多路温度曲线 · 最近60秒
            {chartData.length > 0 && <span className="text-cyber-cyan/60">({chartData.length} 路)</span>}
          </div>
          {chartData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 max-w-[60%] justify-end">
              {chartData.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 text-[10px] font-mono"
                  style={{ color: c.color }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}80` }} />
                  <span className="truncate max-w-[80px]">{c.deviceName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <TempChart sensors={chartData} height={220} />
        {chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-mono">
            <div className="text-center">
              <div className="text-cyber-cyan/50 text-4xl mb-2">◎</div>
              请启动设备以查看温控数据
            </div>
          </div>
        )}
      </div>

      {/* Gauges grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
        {displaySensors.map((x, i) => (
          <TempGauge
            key={x.sensor.id}
            sensor={x.sensor}
            deviceName={x.device!.name}
            deviceId={x.device!.id}
          />
        ))}
      </div>

      {/* Sensor selection for chart */}
      {allSensorList.length > 0 && (
        <div className="rounded-lg border border-cyber-line bg-cyber-panel/40 p-2">
          <div className="text-[10px] font-mono text-slate-500 mb-2 px-1">
            选择在主图表中显示的传感器 (点击切换):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allSensorList.slice(0, 10).map((x, i) => {
              const color = SENSOR_COLORS[i % SENSOR_COLORS.length];
              const selected = selectedIds.includes(x.sensor.id);
              return (
                <button
                  key={x.sensor.id}
                  onClick={() =>
                    setSelectedIds(prev =>
                      prev.includes(x.sensor.id)
                        ? prev.filter(s => s !== x.sensor.id)
                        : [...prev, x.sensor.id]
                    )
                  }
                  className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border transition-all
                    ${selected
                      ? 'bg-opacity-20 border-opacity-80'
                      : 'bg-slate-800/40 border-slate-600/40 opacity-70 hover:opacity-100'
                    }
                  `}
                  style={selected ? {
                    backgroundColor: `${color}20`,
                    borderColor: color,
                    color: color,
                    boxShadow: `0 0 8px ${color}40`,
                  } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {x.device!.id}
                </button>
              );
            })}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-[10px] font-mono px-2 py-1 rounded border border-rose-500/40 text-rose-400/80 hover:bg-rose-900/20"
              >
                清除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
