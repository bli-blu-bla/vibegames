// CI-Schritt 1: Issue aus dem Event lesen, prüfen, Aufgabe nach .agent/ schreiben.
// Ausgaben (GITHUB_OUTPUT): kind, folder, branch
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { root } from '../lib.ts';
import { renderTask, toTask } from './issue.ts';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH as string, 'utf8'));
const task = toTask(event.issue);

if (task.kind === 'game-request' && task.folder && existsSync(root('games', task.folder))) {
  throw new Error(`games/${task.folder} gibt es schon`);
}
if (task.kind !== 'game-request' && task.folder && !existsSync(root('games', task.folder))) {
  throw new Error(`games/${task.folder} gibt es nicht`);
}

mkdirSync(root('.agent'), { recursive: true });
writeFileSync(root('.agent/task.md'), renderTask(task));
writeFileSync(root('.agent/attachments.txt'), task.attachments.join('\n'));

const outputs = {
  kind: task.kind,
  folder: task.folder ?? '',
  branch: `agent/issue-${task.number}`,
};
const out = process.env.GITHUB_OUTPUT;
for (const [k, v] of Object.entries(outputs)) {
  if (out) appendFileSync(out, `${k}=${v}\n`);
  console.log(`${k}=${v}`);
}
