import { type RefObject, useEffect, useRef } from 'react';

export type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Pfeiltasten und WASD als Richtung, sonst null. */
export function keyToDirection(key: string): Direction | null {
  return KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null;
}

/** Diese Tasten gehören der Shell (Pause, Neustart) und kommen nie beim Spiel an. */
const SHELL_KEYS = new Set(['Escape', 'p', 'P', 'r', 'R']);

/**
 * Einzelne Tastendrücke (z. B. Richtung wechseln, springen).
 * Pfeiltasten und Leertaste scrollen die Seite dabei nicht.
 */
export function useKeyDown(onKey: (key: string, event: KeyboardEvent) => void, enabled: boolean) {
  const ref = useRef(onKey);
  ref.current = onKey;

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (SHELL_KEYS.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.startsWith('Arrow') || event.key === ' ') event.preventDefault();
      ref.current(event.key, event);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}

/** Aktuell gedrückte Tasten, für dauerhafte Bewegung im Game Loop: `keys.current.has('ArrowLeft')`. */
export function usePressedKeys(): RefObject<Set<string>> {
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key);
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return keys;
}

/** Wischgeste auf einem Element (Touch und Maus). Mindestweg 24px. */
export function useSwipe(
  target: RefObject<HTMLElement | null>,
  onSwipe: (direction: Direction) => void,
  enabled: boolean,
) {
  const ref = useRef(onSwipe);
  ref.current = onSwipe;

  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) ref.current(dx > 0 ? 'right' : 'left');
      else ref.current(dy > 0 ? 'down' : 'up');
    };
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    };
  }, [target, enabled]);
}

/**
 * Virtueller Joystick (nipplejs) für Touch-Spiele mit freier Bewegung.
 * `onMove` bekommt einen Vektor mit x, y in [-1, 1] (y nach oben positiv); beim Loslassen {0, 0}.
 * nipplejs wird erst geladen, wenn ein Spiel den Joystick wirklich nutzt.
 */
export function useJoystick(
  target: RefObject<HTMLElement | null>,
  onMove: (vector: { x: number; y: number }) => void,
  enabled: boolean,
) {
  const ref = useRef(onMove);
  ref.current = onMove;

  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;
    let destroyed = false;
    let destroy = () => {};
    import('nipplejs').then(({ default: nipplejs }) => {
      if (destroyed) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
      const manager = nipplejs.create({ zone: el, mode: 'dynamic', color: accent });
      manager.on('move', (evt) => ref.current(evt.data.vector));
      manager.on('end', () => ref.current({ x: 0, y: 0 }));
      destroy = () => manager.destroy();
    });
    return () => {
      destroyed = true;
      destroy();
    };
  }, [target, enabled]);
}
