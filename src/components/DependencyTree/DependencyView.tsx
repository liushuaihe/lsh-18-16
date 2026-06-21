import React, { useState } from 'react';
import { useMonitorStore } from '../../store/useMonitorStore';
import { DeviceStatus, STATUS_COLORS, TracePath } from '../../types';
import {
  Network, ChevronDown, ChevronRight, ArrowRight,
  AlertCircle, GitBranch, Cpu, Link2, X,
} from 'lucide-react';

interface Node {
  id: string;
  name: string;
  status: DeviceStatus;
  isCore: boolean;
  children: Node[];
  parentIds: string[];
}

function buildTree(
  ids: string[],
  devices: Record<string, import('../../types').Device>,
  built = new Set<string>()
): Node[] {
  const result: Node[] = [];
  for (const id of ids) {
    if (built.has(id)) continue;
    const dev = devices[id];
    if (!dev) continue;
    built.add(id);
    const childrenIds = Object.values(devices)
      .filter(d => d.dependencyIds.includes(id))
      .map(d => d.id);
    result.push({
      id,
      name: dev.name,
      status: dev.status,
      isCore: dev.isCore,
      parentIds: dev.dependencyIds,
      children: buildTree(childrenIds, devices, built),
    });
  }
  return result;
}

const StatusBadge: React.FC<{ status: DeviceStatus }> = ({ status }) => {
  const c = STATUS_COLORS[status];
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${c.dot}
      ${status === DeviceStatus.FAULT || status === DeviceStatus.FUSED ? 'animate-blink-led' : ''}
      ${status === DeviceStatus.STANDBY ? 'animate-pulse-led' : ''}
      ${status === DeviceStatus.ON ? 'shadow-[0_0_6px_rgba(0,255,136,0.7)]' : ''}
      ${status === DeviceStatus.WARNING ? 'shadow-[0_0_6px_rgba(255,149,0,0.7)] animate-blink-led' : ''}
      ${status === DeviceStatus.FAULT ? 'shadow-[0_0_8px_rgba(255,45,85,0.8)]' : ''}
    `} />
  );
};

const TreeNode: React.FC<{
  node: Node;
  level: number;
  tracePath: TracePath | null;
  onSelect: (id: string) => void;
  selectedId: string | null;
}> = ({ node, level, tracePath, onSelect, selectedId }) => {
  const [collapsed, setCollapsed] = useState(false);
  const inTrace = tracePath?.steps.some(s => s.deviceId === node.id);
  const isRootFault = tracePath?.rootFaultId === node.id;
  const c = STATUS_COLORS[node.status];
  const blockedCause = node.status === DeviceStatus.BLOCKED;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-all group
          ${inTrace || selectedId === node.id
            ? `${isRootFault ? 'bg-red-500/20 border-red-500/70' : 'bg-cyber-cyan/10 border-cyber-cyan/50'} border`
            : 'border border-transparent hover:border-cyber-cyan/30 hover:bg-cyber-card/40'
          }
          ${isRootFault ? 'shadow-neon-red animate-pulse-led' : ''}
        `}
        style={{ marginLeft: `${level * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        {node.children.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-cyber-cyan"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : <span className="w-4" />}

        <StatusBadge status={node.status} />

        <span className={`text-xs font-mono truncate ${c.text}`}>
          {node.id}
        </span>
        <span className={`text-xs truncate flex-1 min-w-0
          ${blockedCause ? 'text-zinc-400 italic' : 'text-slate-200'}
        `}>
          {node.name}
        </span>

        {node.isCore && (
          <span className="inline-flex items-center text-[9px] px-1 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40">
            <Cpu size={9} />
          </span>
        )}

        {node.parentIds.length > 0 && (
          <span className="text-[9px] text-slate-500 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link2 size={9} />
            {node.parentIds.length}
          </span>
        )}

        {isRootFault && (
          <AlertCircle size={12} className="text-red-400 animate-blink-led" />
        )}
      </div>

      {!collapsed && node.children.length > 0 && (
        <div className="relative ml-3 border-l border-dashed border-cyber-cyan/20 pl-2 mt-0.5">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              tracePath={tracePath}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DependencyView: React.FC = () => {
  const { devices, tracePath, clearTracePath } = useMonitorStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const simulateFault = useMonitorStore(s => s.simulateFault);
  const toggle = useMonitorStore(s => s.toggleDevice);
  const startChain = useMonitorStore(s => s.startDependencyChain);

  const rootIds = Object.values(devices)
    .filter(d => d.dependencyIds.length === 0)
    .map(d => d.id);
  const tree = buildTree(rootIds, devices);
  const selected = selectedId ? devices[selectedId] : null;

  return (
    <div className="rounded-lg border border-cyber-line bg-cyber-panel/70 p-3 relative overflow-hidden hud-corner">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-cyber-cyan" />
          <span className="font-orbitron text-xs tracking-[0.15em] text-cyber-cyan neon-text-cyan">
            设备依赖树
          </span>
        </div>
        {tracePath && (
          <button
            onClick={clearTracePath}
            className="text-[10px] font-mono px-2 py-1 rounded
              bg-rose-900/30 text-rose-300 border border-rose-500/50
              hover:bg-rose-900/50 flex items-center gap-1"
          >
            <Network size={10} />
            清除追踪高亮
          </button>
        )}
      </div>

      <div className="max-h-[280px] overflow-y-auto pr-1 flex flex-col gap-0.5">
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            tracePath={tracePath}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ))}
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-cyber-line/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono ${STATUS_COLORS[selected.status].text}`}>
                {selected.id}
              </span>
              <span className="text-sm text-slate-200">{selected.name}</span>
              <StatusBadge status={selected.status} />
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          </div>

          {selected.dependencyIds.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-mono text-slate-500 mb-1">前置依赖</div>
              <div className="flex flex-wrap items-center gap-1">
                {selected.dependencyIds.map(depId => {
                  const dep = devices[depId];
                  if (!dep) return null;
                  const ok = dep.status === DeviceStatus.ON || dep.status === DeviceStatus.STANDBY || dep.status === DeviceStatus.WARNING;
                  return (
                    <div
                      key={depId}
                      onClick={() => setSelectedId(depId)}
                      className={`flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-all
                        ${ok
                          ? 'bg-emerald-900/20 text-emerald-300 border-emerald-500/40 hover:shadow-neon-green'
                          : 'bg-rose-900/30 text-rose-300 border-rose-500/50'
                        }
                      `}
                    >
                      <StatusBadge status={dep.status} />
                      {depId}
                      <ArrowRight size={9} className="text-slate-500 ml-0.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selected.status === DeviceStatus.BLOCKED && selected.blockReason && (
            <div className="text-[11px] font-mono text-amber-300 bg-amber-900/20 rounded px-2 py-1 border border-amber-500/30 mb-2">
              {selected.blockReason}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {selected.status !== DeviceStatus.FAULT &&
             selected.status !== DeviceStatus.FUSED &&
             selected.status !== DeviceStatus.BLOCKED && (
              <button
                onClick={() => toggle(selected.id)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
                  ${selected.status === DeviceStatus.OFF
                    ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/50 hover:shadow-neon-cyan'
                    : 'bg-rose-900/30 text-rose-300 border-rose-500/50 hover:bg-rose-900/50'
                  }
                `}
              >
                {selected.status === DeviceStatus.OFF ? '启动' : '关闭'}
              </button>
            )}
            {selected.status === DeviceStatus.OFF && selected.dependencyIds.length > 0 && (
              <button
                onClick={() => startChain(selected.id)}
                className="text-[10px] font-mono px-2 py-1 rounded
                  bg-emerald-900/30 text-emerald-300 border border-emerald-500/50
                  hover:bg-emerald-900/50"
              >
                启动依赖链
              </button>
            )}
            {selected.status !== DeviceStatus.FAULT &&
             selected.status !== DeviceStatus.FUSED && (
              <button
                onClick={() => simulateFault(selected.id, `E${Math.floor(Math.random() * 900 + 100)}`)}
                className="text-[10px] font-mono px-2 py-1 rounded
                  bg-red-900/30 text-red-300 border border-red-500/50
                  hover:bg-red-900/50"
              >
                模拟故障
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
