import { TopBar } from '@/components/TopBar/TopBar';
import { DevicePanel } from '@/components/DevicePanel/DeviceGroup';
import { TempMonitor } from '@/components/TempMonitor/TempMonitor';
import { AlertPanel } from '@/components/AlertPanel/AlertPanel';
import { FuseBanner } from '@/components/AlertPanel/FuseBanner';
import { DependencyView } from '@/components/DependencyTree/DependencyView';
import { LifeStatsPanel } from '@/components/LifeStats/LifeStatsPanel';
import { useTemperatureSimulation } from '@/hooks/useTemperatureSimulation';
import { useMonitorStore } from '@/store/useMonitorStore';
import { DEVICE_GROUPS } from '@/data/mockData';

export default function Home() {
  useTemperatureSimulation();
  const { alerts, visualFlash } = useMonitorStore();

  return (
    <div className={`w-screen h-screen flex flex-col bg-cyber-bg overflow-hidden relative
      ${visualFlash === 'fault' ? 'flash-fault' : ''}
      ${visualFlash === 'fuse' ? 'flash-fuse' : ''}
    `}>
      <div className="absolute inset-0 pointer-events-none cyber-grid opacity-30" />
      <div className="absolute inset-0 pointer-events-none bg-noise" />

      <TopBar />

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* LEFT PANEL */}
        <div className="w-[42%] xl:w-[44%] h-full border-r border-cyber-line/70 p-4 flex flex-col gap-4 bg-cyber-bg/60">
          <div className="flex-1 min-h-0">
            <DevicePanel groups={DEVICE_GROUPS} />
          </div>
          <div className="flex-shrink-0">
            <DependencyView />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 h-full flex flex-col gap-4 p-4 bg-cyber-bg/50 overflow-y-auto">
          <FuseBanner />

          <div className="flex-shrink-0">
            <LifeStatsPanel />
          </div>

          <div className="flex-1 grid grid-rows-[auto_1fr] gap-4 min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <TempMonitor />
            </div>
            <AlertPanel alerts={alerts} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyber-cyan/50 to-transparent pointer-events-none" />
      <div className="absolute top-14 left-0 w-0.5 bottom-0 bg-gradient-to-b from-cyber-cyan/40 via-transparent to-cyber-cyan/40 pointer-events-none" style={{ left: '42%' }} />
    </div>
  );
}
