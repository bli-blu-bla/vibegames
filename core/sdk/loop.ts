import { useEffect, useRef } from 'react';

/**
 * Ruft `update(dt)` jeden Frame auf (requestAnimationFrame), solange `running` true ist.
 * `dt` ist die vergangene Zeit in Sekunden, höchstens 0.1 (nach Tab-Wechsel kein Sprung).
 */
export function useGameLoop(update: (dt: number) => void, running: boolean) {
  const ref = useRef(update);
  ref.current = update;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      ref.current(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

/** Ruft `tick()` alle `intervalMs` auf, solange `running` true ist. Für rundenbasierte Raster-Spiele. */
export function useTicker(intervalMs: number, tick: () => void, running: boolean) {
  const ref = useRef(tick);
  ref.current = tick;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => ref.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, running]);
}
