import { describe, expect, it } from 'vitest';
import { checkLogo } from './logo.ts';

const svg = (inner: string, attrs = 'viewBox="0 0 64 64"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe('checkLogo', () => {
  it('akzeptiert currentColor und Tokens', () => {
    expect(
      checkLogo(svg('<rect fill="currentColor"/><rect style="fill: var(--game-rose)"/>')),
    ).toEqual([]);
  });
  it('lehnt Hex, falsche viewBox, Text und Script ab', () => {
    expect(checkLogo(svg('<rect fill="#ff0000"/>'))).toHaveLength(1);
    expect(checkLogo(svg('', 'viewBox="0 0 32 32"'))).toHaveLength(1);
    expect(checkLogo(svg('<text>A</text>'))).toHaveLength(1);
    expect(checkLogo(svg('<script>alert(1)</script>'))).toHaveLength(1);
  });
  it('erlaubt höchstens drei Farben', () => {
    const four = ['currentColor', 'var(--accent)', 'var(--danger)', 'var(--game-sky)']
      .map((c) => `<rect fill="${c}"/>`)
      .join('');
    expect(checkLogo(svg(four))).toHaveLength(1);
  });
});
