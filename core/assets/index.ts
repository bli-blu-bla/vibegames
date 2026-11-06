/**
 * Zugriff auf geteilte Assets aus /assets. Nur lesen, nie ändern.
 * IDs stehen in assets/manifest.json.  assetUrl('click')  playSound('click')
 */
import type { Howl } from 'howler';
import manifest from '../../assets/manifest.json';
import { useSoundStore } from '../sdk/sound.ts';

export interface AssetEntry {
  id: string;
  file: string;
  use: string;
  license: string;
  source: string;
}

export type AssetManifest = Record<'sounds' | 'sprites' | 'fonts', AssetEntry[]>;

const urls = import.meta.glob<string>(['/assets/**/*', '!/assets/manifest.json'], {
  eager: true,
  query: '?url',
  import: 'default',
});

const entries = new Map(
  Object.values(manifest as AssetManifest)
    .flat()
    .map((entry) => [entry.id, entry]),
);

/** URL eines geteilten Assets. Wirft bei unbekannter ID, damit Tippfehler sofort auffallen. */
export function assetUrl(id: string): string {
  const entry = entries.get(id);
  const url = entry && urls[`/assets/${entry.file}`];
  if (!url) throw new Error(`Unbekanntes Asset "${id}". Siehe assets/manifest.json`);
  return url;
}

const howls = new Map<string, Promise<Howl>>();

/** Spielt einen geteilten Sound (Datei) über Howler ab. Für Effekte per Code: playSfx() aus @core/sdk. */
export async function playSound(id: string, volume = 0.6) {
  if (useSoundStore.getState().muted) return;
  let howl = howls.get(id);
  if (!howl) {
    const src = assetUrl(id);
    howl = import('howler').then(({ Howl }) => new Howl({ src: [src], volume }));
    howls.set(id, howl);
  }
  (await howl).play();
}
