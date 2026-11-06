export type CreditType = 'assets' | 'icons' | 'fonts' | 'sounds' | 'libraries';

/** Inhalt von credits/<id>/credit.json */
export interface CreditJson {
  name: string;
  author: string;
  url: string;
  /** SPDX-ID, z. B. CC0-1.0, MIT, OFL-1.1 */
  license: string;
  type: CreditType;
  /** "shared" für geteilte Assets, sonst Ordnernamen von Games */
  usedIn: string[];
  /** npm-Pakete dieser Quelle. Sie erscheinen dann nicht doppelt in der automatischen Liste. */
  packages?: string[];
}

export interface LibraryCredit {
  name: string;
  author: string;
  url: string;
  license: string;
  licenseText: string;
}
