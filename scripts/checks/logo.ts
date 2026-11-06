// Regeln für games/<ordner>/logo.svg (siehe design/README.md, "Icons und Logo")
import { COLOR_TOKENS } from '../../core/sdk/tokens.ts';

const TOKENS = new Set<string>(COLOR_TOKENS);

export function checkLogo(svg: string): string[] {
  const errors: string[] = [];
  if (!/<svg\b[^>]*\bviewBox=["']0 0 64 64["']/.test(svg))
    errors.push('viewBox muss "0 0 64 64" sein');
  if (/<script|\son\w+\s*=|javascript:/i.test(svg)) errors.push('kein Script, keine Event-Handler');
  if (/<(image|foreignObject|use)\b|\b(xlink:)?href\s*=/i.test(svg)) {
    errors.push('keine Bilder, Links oder <use>');
  }
  if (/<text\b/i.test(svg)) errors.push('keine Schrift im Logo');
  if (/Gradient|<filter\b|<style\b|@import/i.test(svg)) {
    errors.push('keine Verläufe, Filter oder <style>');
  }

  const values = [
    ...svg.matchAll(/\b(?:fill|stroke|color|stop-color)\s*[:=]\s*["']?\s*([^"';>]+)/gi),
  ].map((m) => (m[1] as string).trim());
  const colors = new Set<string>();
  for (const value of values) {
    if (value === 'none') continue;
    if (value === 'currentColor') {
      colors.add(value);
      continue;
    }
    const token = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1];
    if (token && TOKENS.has(token)) colors.add(token);
    else errors.push(`Farbe "${value}" nicht erlaubt: nur currentColor oder var(--token)`);
  }
  if (colors.size > 3) errors.push(`höchstens drei Farben, gefunden: ${[...colors].join(', ')}`);
  return errors;
}
