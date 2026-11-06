import { describe, expect, it } from 'vitest';
import { findAttachments, parseFormBody, toTask } from './issue.ts';

const body = `### Titel

Pixel-Snake

### Ordnername

pixel-snake

### Assets

![bild](https://github.com/user-attachments/assets/1234-abcd)
[sound.ogg](https://github.com/user-attachments/files/99/sound.ogg)

### Steuerung

_No response_`;

describe('issue parsing', () => {
  it('liest Felder', () => {
    expect(parseFormBody(body)).toMatchObject({
      Titel: 'Pixel-Snake',
      Ordnername: 'pixel-snake',
      Steuerung: '',
    });
  });
  it('findet Anhänge', () => {
    expect(findAttachments(body)).toEqual([
      'https://github.com/user-attachments/assets/1234-abcd',
      'https://github.com/user-attachments/files/99/sound.ogg',
    ]);
  });
  it('baut Tasks', () => {
    const task = toTask({ number: 1, body, labels: [{ name: 'game-request' }] });
    expect(task.folder).toBe('pixel-snake');
    expect(task.attachments).toHaveLength(2);
    const feature = toTask({
      number: 2,
      body: '### Spiel\n\nPixel-Snake (snake)\n\n### Was soll dazukommen?\n\nLevel',
      labels: [{ name: 'feature' }],
    });
    expect(feature.folder).toBe('snake');
    const coreBug = toTask({
      number: 3,
      body: '### Core oder Game?\n\nCore',
      labels: [{ name: 'bug' }],
    });
    expect(coreBug.folder).toBeNull();
  });
  it('lehnt ungültige Ordnernamen ab', () => {
    expect(() =>
      toTask({ number: 1, body: '### Ordnername\n\n../core', labels: [{ name: 'game-request' }] }),
    ).toThrow();
  });
});
