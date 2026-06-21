import { useEffect, useRef } from 'react';
import { useMonitorStore } from '../store/useMonitorStore';

export function useTemperatureSimulation() {
  const tick = useMonitorStore(s => s.tickTemperature);
  const rafRef = useRef<number>();
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    const INTERVAL = 500;

    const loop = () => {
      const now = performance.now();
      if (now - lastTickRef.current >= INTERVAL) {
        tick();
        lastTickRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);
}
