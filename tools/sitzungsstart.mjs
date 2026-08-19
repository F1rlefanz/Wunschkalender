#!/usr/bin/env node
/**
 * Sessionstart-Hook: leitet den Projektstand aus den echten Quellen ab.
 *
 * Bewusst KEINE Handoff-Datei: alles hier kommt aus Git und aus GitHub Issues.
 * Damit kann der Stand nicht veralten, ohne dass jemand ihn tatsaechlich aendert.
 * Faellt eine Quelle aus (kein Netz, kein gh), fehlt nur ihr Abschnitt.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const lauf = (befehl, standard = null) => {
  try {
    return execSync(befehl, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return standard;
  }
};

const zeilen = [];
const abschnitt = (titel, inhalt) => {
  if (inhalt) zeilen.push(`## ${titel}\n${inhalt}`);
};

// --- Git ---
const branch = lauf('git rev-parse --abbrev-ref HEAD', '(unbekannt)');
const schmutzig = lauf('git status --porcelain', '');
const commits = lauf('git log --oneline -3', '');

abschnitt(
  'Arbeitsstand',
  [
    `Branch: **${branch}**${branch === 'main' ? ' (Integrationsbranch — fuer Aenderungen erst abzweigen)' : ''}`,
    schmutzig ? `Arbeitsbaum: ${schmutzig.split('\n').length} geaenderte Datei(en), nicht committet` : 'Arbeitsbaum: sauber',
    commits ? `\nLetzte Commits:\n${commits.split('\n').map((z) => `- ${z}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n'),
);

// --- Offene Aufgaben aus GitHub ---
const issues = lauf('gh issue list --state open --limit 30 --json number,title,labels,milestone');
if (issues) {
  try {
    const liste = JSON.parse(issues);
    if (liste.length === 0) {
      abschnitt('Offene Aufgaben', 'Keine offenen Issues.');
    } else {
      const nachMeilenstein = new Map();
      for (const i of liste) {
        const m = i.milestone?.title ?? 'ohne Meilenstein';
        if (!nachMeilenstein.has(m)) nachMeilenstein.set(m, []);
        const labels = i.labels.map((l) => l.name).join(', ');
        nachMeilenstein.get(m).push(`- #${i.number} ${i.title}${labels ? ` _(${labels})_` : ''}`);
      }
      const text = [...nachMeilenstein.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, eintraege]) => `**${m}**\n${eintraege.join('\n')}`)
        .join('\n\n');
      abschnitt(`Offene Aufgaben (${liste.length})`, `${text}\n\nDetails zu einer Aufgabe: \`gh issue view <nr>\``);
    }
  } catch {
    /* kaputte Ausgabe -> Abschnitt entfaellt */
  }
} else {
  abschnitt(
    'Offene Aufgaben',
    'Nicht abrufbar (kein GitHub-Remote, kein Netz oder `gh` nicht angemeldet).\n' +
      'Offene Punkte gehoeren in GitHub Issues, nicht in Dateien im Repo.',
  );
}

// --- Umgebung ---
const hinweise = [];
if (!existsSync('node_modules')) hinweise.push('`node_modules` fehlt — zuerst `npm install`.');
if (!existsSync('db.json')) hinweise.push('`db.json` fehlt — wird beim ersten Schreibzugriff aus den Beispieldaten angelegt.');
if (hinweise.length) abschnitt('Umgebung', hinweise.map((h) => `- ${h}`).join('\n'));

if (zeilen.length) {
  console.log(`# Projektstand Wunschkalender\n\n${zeilen.join('\n\n')}`);
}
