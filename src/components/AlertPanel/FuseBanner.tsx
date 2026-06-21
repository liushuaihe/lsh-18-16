import React, { useState } from 'react';
import { useMonitorStore } from '../../store/useMonitorStore';
import { ZapOff, RotateCcw, AlertTriangle, PowerOff, ShieldAlert } from 'lucide-react';

export const FuseBanner: React.FC = () => {
  const {
    globalFuseActive, fuseReason, fuseTimestamp,
    resetFuse, forceShutdownAll, alerts,
  } = useMonitorStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmShutdown, setConfirmShutdown] = useState(false);

  const fuseAlerts = alerts.filter(a => a.level === 'fuse');
  const duration = fuseTimestamp ? Math.floor((Date.now() - fuseTimestamp) / 1000) : 0;
  const [, forceTick] = useState(0);
  React.useEffect(() => {
    if (!globalFuseActive || !fuseTimestamp) return;
    const t = setInterval(() => forceTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [globalFuseActive, fuseTimestamp]);

  if (!globalFuseActive) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(0,255,136,0.8)]" />
          <span className="text-xs font-mono text-emerald-300">
            主回路正常 · 安全阈值在线
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmShutdown(v => !v)}
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border
              border-slate-600/50 text-slate-400 hover:border-rose-500/60 hover:text-rose-300 hover:bg-rose-950/30 transition-all"
          >
            <PowerOff size={11} />
            紧急全停
          </button>
          {confirmShutdown && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-rose-400">确认?</span>
              <button
                onClick={() => { forceShutdownAll(); setConfirmShutdown(false); }}
                className="text-[10px] font-mono px-2 py-1 rounded
                  bg-rose-500/80 text-white hover:bg-rose-500 animate-blink-led"
              >
                是
              </button>
              <button
                onClick={() => setConfirmShutdown(false)}
                className="text-[10px] font-mono px-2 py-1 rounded
                  bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                否
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border-2 border-red-500/80 bg-gradient-to-r from-red-950/80 via-rose-950/70 to-red-950/80 p-3 shadow-neon-red overflow-hidden screen-shake">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.05)_0px,rgba(255,255,255,0.05)_10px,transparent_10px,transparent_20px)] animate-[scanline_2s_linear_infinite]" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShieldAlert size={28} className="text-red-400" />
              <span className="absolute inset-0 rounded-full border-2 border-red-500 pulse-ring" />
              <span className="absolute inset-0 rounded-full border-2 border-red-500 pulse-ring" style={{ animationDelay: '0.4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-lg text-red-400 neon-text-red tracking-wider animate-blink-led">
                  ⚠ FUSE TRIPPED · 强制熔断
                </span>
              </div>
              <div className="text-xs font-mono text-red-300/90 mt-0.5">
                持续时间: {Math.floor(duration / 60)}分{duration % 60}秒
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded
                  bg-emerald-600/90 text-white hover:bg-emerald-500 border border-emerald-400/60
                  shadow-[0_0_12px_rgba(0,255,136,0.4)] transition-all"
              >
                <RotateCcw size={13} />
                复位熔断
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-emerald-300 animate-blink-led">
                  确认复位?
                </span>
                <button
                  onClick={() => { resetFuse(); setConfirmReset(false); }}
                  className="text-xs font-mono px-3 py-1.5 rounded
                    bg-emerald-500 text-white hover:bg-emerald-400 shadow-neon-green"
                >
                  ✓ 确认
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-xs font-mono px-3 py-1.5 rounded
                    bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>

        {fuseReason && (
          <div className="rounded bg-black/40 border border-red-500/50 p-2 mb-2">
            <div className="flex items-start gap-2">
              <ZapOff size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm font-mono text-red-200 leading-relaxed">
                {fuseReason}
              </div>
            </div>
          </div>
        )}

        {fuseAlerts.length > 0 && (
          <div className="text-[10px] font-mono text-red-400/80 flex flex-wrap items-center gap-2">
            <span>相关记录:</span>
            {fuseAlerts.slice(0, 3).map(a => (
              <span key={a.id} className="px-1.5 py-0.5 rounded bg-red-950/60 border border-red-500/40">
                {a.deviceId}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
