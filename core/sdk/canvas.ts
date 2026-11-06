import { useCallback, useEffect, useRef } from 'react';

/**
 * Canvas 2D mit scharfer Darstellung auf HiDPI-Displays.
 * Koordinaten in `draw` sind immer logische Pixel (0..width, 0..height).
 *
 *   const canvas = useCanvas(320, 320);
 *   canvas.draw((ctx) => { ctx.fillRect(0, 0, 10, 10); });
 *   return <canvas {...canvas.props} aria-label="Spielfeld" />;
 */
export function useCanvas(width: number, height: number) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }, [width, height]);

  const draw = useCallback(
    (render: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const ratio = canvas.width / width;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      render(ctx);
    },
    [width, height],
  );

  return {
    draw,
    props: {
      ref,
      className: 'game-canvas',
      style: { width: '100%', maxWidth: width, aspectRatio: `${width} / ${height}` },
    },
  };
}
