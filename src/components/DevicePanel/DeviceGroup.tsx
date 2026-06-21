import React, { useState } from 'react';
import { Device, DeviceStatus, ToggleResult, TracePath } from '../../types';
import { DeviceToggle } from './DeviceToggle';
import { useMonitorStore } from '../../store/useMonitorStore';
import { Network, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';

interface GroupDef {
  id: string;
  name: string;
  deviceIds: string[];
}

interface Props {
  groups: GroupDef[];
}

export const DevicePanel: React.FC<Props> = ({ groups }) => {
  const { devices, toggleDevice, startDependencyChain, tracePath, visualFlash } = useMonitorStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [simulateMenu, setSimulateMenu] = useState<string | null>(null);
  const simulateFault = useMonitorStore(s => s.simulateFault);
  const simulateSpike = useMonitorStore(s => s.simulateSpike);
  const setTracePath = useMonitorStore(s => s.clearTracePath);
  const clearTracePath = useMonitorStore(s => s.clearTracePath);

  const highlightIds = new Set<string>();
  if (tracePath) {
    tracePath.steps.forEach(s => highlightIds.add(s.deviceId));
  }

  const handleShowDeps = (id: string) => {
    const dev = devices[id];
    if (!dev) return;
    if (dev.status === DeviceStatus.FAULT || dev.status === DeviceStatus.FUSED) {
      return;
    }
  };

  const deviceToggle = (id: string): ToggleResult => toggleDevice(id);
  const deviceStartChain = (id: string): ToggleResult => startDependencyChain(id);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-orbitron text-sm tracking-[0.2em] text-cyber-cyan neon-text-cyan flex items-center gap-2">
          <Settings2 size={16} />
          设备控制矩阵
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="px-2 py-1 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-500/40">
            {Object.values(devices).filter(d => d.status === DeviceStatus.ON).length} ON
          </span>
          <span className="px-2 py-1 rounded bg-rose-900/30 text-rose-400 border border-rose-500/40">
            {Object.values(devices).filter(d =>
              d.status === DeviceStatus.FAULT ||
              d.status === DeviceStatus.FUSED ||
              d.status === DeviceStatus.WARNING
            ).length} ERR
          </span>
        </div>
      </div>

      {tracePath && (
        <div className="relative rounded-lg p-3 bg-rose-950/40 border border-rose-500/60 shadow-neon-red">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-rose-300 font-mono text-xs">
              <Network size={14} />
              受影响链路追踪 · {tracePath.steps.length} 台设备
            </div>
            <button
              onClick={clearTracePath}
              className="text-[10px] px-2 py-1 rounded bg-slate-800/70 text-slate-400 border border-slate-600/50 hover:text-rose-300"
            >
              隐藏
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {tracePath.steps.map((step, idx) => (
              <React.Fragment key={step.deviceId}>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border
                  ${step.level === 0
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/70'
                    : 'bg-amber-900/30 text-amber-300 border-amber-500/50'
                  }`}>
                  {step.level === 0 ? '🔥 ' : ''}
                  {step.deviceName}
                </span>
                {idx < tracePath.steps.length - 1 && (
                  <span className="text-rose-500/70">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {groups.map(group => {
        const isCollapsed = !!collapsed[group.id];
        const groupDevices = group.deviceIds.map(id => devices[id]).filter(Boolean);
        const hasProblems = groupDevices.some(d =>
          d.status === DeviceStatus.FAULT ||
          d.status === DeviceStatus.FUSED ||
          d.status === DeviceStatus.WARNING ||
          d.status === DeviceStatus.BLOCKED
        );
        const allOn = groupDevices.every(d =>
          d.status === DeviceStatus.ON || d.status === DeviceStatus.WARNING
        );
        return (
          <div
            key={group.id}
            className={`rounded-lg border bg-cyber-panel/60 backdrop-blur-sm relative overflow-hidden hud-corner
              ${hasProblems ? 'border-rose-500/40' : allOn ? 'border-emerald-500/30' : 'border-cyber-line'}
            `}
          >
            <button
              onClick={() => setCollapsed(c => ({ ...c, [group.id]: !c[group.id] }))}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-cyber-line/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? <ChevronRight size={14} className="text-cyber-cyan" /> : <ChevronDown size={14} className="text-cyber-cyan" />}
                <span className="font-orbitron text-xs tracking-[0.15em] text-cyber-cyan">{group.name}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {group.deviceIds.length} UNITS
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasProblems && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-blink-led shadow-[0_0_6px_rgba(255,45,85,0.8)]" />
                )}
                {allOn && !hasProblems && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(0,255,136,0.7)]" />
                )}
                <span className="text-[10px] font-mono text-slate-400">
                  {groupDevices.filter(d => d.status === DeviceStatus.ON || d.status === DeviceStatus.WARNING).length}
                  <span className="text-slate-600"> / {group.deviceIds.length}</span>
                </span>
              </div>
            </button>

            {!isCollapsed && (
              <div className="px-3 pb-3 pt-1">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                  {group.deviceIds.map(id => {
                    const dev = devices[id];
                    if (!dev) return null;
                    const isHighlighted = highlightIds.has(id);
                    const isFault = dev.status === DeviceStatus.FAULT || dev.status === DeviceStatus.FUSED;
                    return (
                      <div key={id} className="relative">
                        <DeviceToggle
                          device={dev}
                          toggle={deviceToggle}
                          startChain={deviceStartChain}
                          onShowDeps={handleShowDeps}
                          highlight={isHighlighted}
                          flashType={visualFlash && (isFault || isHighlighted) ? visualFlash : null}
                        />
                        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100">
                          <div className="relative">
                            <button
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                setSimulateMenu(id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 rounded text-[9px]
                                bg-slate-800/80 text-slate-500 border border-slate-600/40
                                hover:bg-rose-900/40 hover:text-rose-400 hover:border-rose-500/50
                                flex items-center justify-center transition-all"
                              title="模拟故障"
                            >
                              !
                            </button>
                            {simulateMenu === id && (
                              <div
                                className="absolute top-6 right-0 z-50 w-40 rounded-lg
                                  bg-slate-900/95 border border-rose-500/40 shadow-neon-red p-1.5
                                  flex flex-col gap-1"
                                onMouseLeave={() => setSimulateMenu(null)}
                              >
                                <div className="text-[10px] text-slate-500 font-mono px-1 pb-1 border-b border-slate-700">模拟事件</div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    simulateFault(id, `E${Math.floor(Math.random() * 900 + 100)}`);
                                    setSimulateMenu(null);
                                  }}
                                  className="text-left text-[11px] px-2 py-1 rounded text-rose-300
                                    hover:bg-rose-900/40 font-mono"
                                >
                                  硬件故障
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const s = useMonitorStore.getState().sensors;
                                    const sen = s[dev.tempSensorId];
                                    simulateSpike(id, sen ? sen.warningThreshold + 3 : 60);
                                    setSimulateMenu(null);
                                  }}
                                  className="text-left text-[11px] px-2 py-1 rounded text-amber-300
                                    hover:bg-amber-900/30 font-mono"
                                >
                                  温度飙至警示
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const s = useMonitorStore.getState().sensors;
                                    const sen = s[dev.tempSensorId];
                                    simulateSpike(id, sen ? sen.criticalThreshold + 3 : 80);
                                    setSimulateMenu(null);
                                  }}
                                  className="text-left text-[11px] px-2 py-1 rounded text-orange-300
                                    hover:bg-orange-900/30 font-mono"
                                >
                                  温度飙至严重
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const s = useMonitorStore.getState().sensors;
                                    const sen = s[dev.tempSensorId];
                                    simulateSpike(id, sen ? sen.fuseThreshold + 2 : 100);
                                    setSimulateMenu(null);
                                  }}
                                  className="text-left text-[11px] px-2 py-1 rounded text-red-300
                                    hover:bg-red-900/40 font-mono"
                                >
                                  温度突破熔断
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="absolute inset-0 rounded-lg pointer-events-none group-hover:opacity-100 transition-opacity">
                          <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-lg opacity-0 hover:opacity-100">
                            <div className="rod-trace" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
