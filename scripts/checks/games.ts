import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { CATEGORY_LABELS, type GameJson } from '../../core/sdk/types.ts';
import { FOLDER_PATTERN, listDirs, Report, readJson, root } from '../lib.ts';
import { checkLogo } from './logo.ts';

const FORMATS = ['points', 'moves', 'ms', 'seconds'];

export function checkGames(): Report {
  const report = new Report('Games');
  const credits = new Set(listDirs(root('credits')));
  const games = listDirs(root('games'));
  if (games.length === 0) report.error('games/ ist leer');

  for (const id of games) {
    const at = (file: string) => root('games', id, file);
    const err = (msg: string) => report.error(`games/${id}: ${msg}`);
    if (!FOLDER_PATTERN.test(id)) err('Ordnername nur a-z, 0-9 und -');

    for (const file of ['game.json', 'logo.svg', 'main.tsx']) {
      if (!existsSync(at(file))) err(`${file} fehlt`);
    }
    if (!readdirSync(root('games', id)).some((f) => f.endsWith('.test.ts'))) {
      err('mindestens ein Test (*.test.ts) für die Spiellogik fehlt');
    }

    if (existsSync(at('logo.svg'))) {
      for (const e of checkLogo(readFileSync(at('logo.svg'), 'utf8'))) err(`logo.svg: ${e}`);
    }
    if (
      existsSync(at('main.tsx')) &&
      !/export default/.test(readFileSync(at('main.tsx'), 'utf8'))
    ) {
      err('main.tsx braucht einen default export (die Spiel-Komponente)');
    }
    if (!existsSync(at('game.json'))) continue;

    let game: GameJson;
    try {
      game = readJson<GameJson>(at('game.json'));
    } catch {
      err('game.json ist kein gültiges JSON');
      continue;
    }
    const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    if (!str(game.title)) err('game.json: title fehlt');
    if (!str(game.description)) err('game.json: description fehlt');
    else if (game.description.length > 120) err('game.json: description höchstens 120 Zeichen');
    if (!str(game.controls)) err('game.json: controls fehlt');
    if (!(game.category in CATEGORY_LABELS)) {
      err(`game.json: category muss eins von ${Object.keys(CATEGORY_LABELS).join(', ')} sein`);
    }
    if (!game.score || !str(game.score.label)) err('game.json: score.label fehlt');
    else {
      if (game.score.label !== game.score.label.toUpperCase()) {
        err('game.json: score.label in Großbuchstaben (z. B. HIGHSCORE)');
      }
      if (!['higher', 'lower'].includes(game.score.better)) {
        err('game.json: score.better ist higher oder lower');
      }
      if (!FORMATS.includes(game.score.format)) {
        err(`game.json: score.format ist eins von ${FORMATS.join(', ')}`);
      }
    }
    if (game.multiplayer !== undefined && !['versus', 'coop'].includes(game.multiplayer)) {
      err('game.json: multiplayer ist versus oder coop (oder weglassen)');
    }
    if (game.players !== undefined) {
      if (!game.multiplayer) err('game.json: players nur zusammen mit multiplayer');
      if (!Number.isInteger(game.players) || game.players < 2 || game.players > 4) {
        err('game.json: players ist 2, 3 oder 4 (oder weglassen)');
      }
    }
    if (!Array.isArray(game.credits)) err('game.json: credits muss ein Array sein ([] wenn leer)');
    else {
      for (const c of game.credits) if (!credits.has(c)) err(`Credit "${c}" fehlt in credits/`);
    }
  }
  return report;
}
