declare module 'zzfx' {
  export function zzfx(...parameters: (number | undefined)[]): AudioBufferSourceNode;
}

declare module 'virtual:library-credits' {
  import type { LibraryCredit } from './credits/types.ts';

  const libraries: LibraryCredit[];
  export default libraries;
}
