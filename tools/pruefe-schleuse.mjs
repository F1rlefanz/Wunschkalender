#!/usr/bin/env node
/**
 * Schleuse: PreToolUse-Hook auf Bash.
 *
 * Waehrend der Arbeit blockiert nichts. Erst wenn Arbeit den Branch verlaesst
 * (git merge / git push), wird geprueft, was mechanisch pruefbar ist.
 * Urteilsfragen stehen in .claude/skills/, nicht hier.
 *
 * Exit 0 = durchlassen, Exit 2 = blockieren (stderr geht an Claude zurueck).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const CLAUDE_MD_BUDGET = 12000; // Zeichen. Die Datei liegt in JEDER Nachricht im Kontext.

const lauf = (befehl) => {
  try {
    return { ok: true, ausgabe: execSync(befehl, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (fehler) {
    return { ok: false, ausgabe: `${fehler.stdout ?? ''}${fehler.stderr ?? ''}` };
  }
};

let eingabe = '';
try {
  eingabe = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let befehl = '';
try {
  befehl = JSON.parse(eingabe)?.tool_input?.command ?? '';
} catch {
  process.exit(0);
}

// Nur an der Schleuse pruefen. --dry-run und --no-verify sind keine Schleuse.
if (!/\bgit\s+(merge|push)\b/.test(befehl) || /--dry-run/.test(befehl)) process.exit(0);

const probleme = [];

// 1. Nie Zugangsdaten veroeffentlichen.
const getrackt = lauf('git ls-files db.json');
if (getrackt.ok && getrackt.ausgabe.trim()) {
  probleme.push('`db.json` ist von Git getrackt. Die Datei enthaelt Benutzerkonten und Passwoerter und darf nicht ins Repository. Entfernen mit `git rm --cached db.json`.');
}

// 2. Typpruefung.
const lint = lauf('npm run lint --silent');
if (!lint.ok) probleme.push(`\`npm run lint\` schlaegt fehl:\n${lint.ausgabe.trim().split('\n').slice(-15).join('\n')}`);

// 3. Tests.
const tests = lauf('npm test --silent');
if (!tests.ok) probleme.push(`\`npm test\` schlaegt fehl:\n${tests.ausgabe.trim().split('\n').slice(-15).join('\n')}`);

// 4. Changelog und Version — nur, wenn die Aenderungen ueberhaupt nutzersichtbar sind.
//
// Die Vergleichsbasis haengt davon ab, wo wir stehen: auf einem Feature-Branch ist es
// `main`, auf `main` selbst muss es `origin/main` sein. Sonst waere die Basis gleich HEAD,
// die Commit-Liste leer und die Pruefung wuerde ausgerechnet beim Push stillschweigend
// durchwinken.
const branch = lauf('git rev-parse --abbrev-ref HEAD').ausgabe?.trim();
const referenz = branch === 'main' ? 'origin/main' : 'main';
const basis = lauf(`git merge-base HEAD ${referenz}`);
if (basis.ok && basis.ausgabe.trim()) {
  const betreffs = lauf(`git log ${basis.ausgabe.trim()}..HEAD --format=%s`);
  const nachrichten = betreffs.ok ? betreffs.ausgabe.trim().split('\n').filter(Boolean) : [];
  const nurIntern = nachrichten.length > 0 && nachrichten.every((n) => /^(chore|refactor|test|docs|ci|style|build|merge)(\(.+\))?!?:/i.test(n));

  if (nachrichten.length > 0 && !nurIntern) {
    if (existsSync('CHANGELOG.md')) {
      const changelog = readFileSync('CHANGELOG.md', 'utf8');
      const unreleased = changelog.split(/^## \[Unreleased\]/m)[1] ?? '';
      const inhalt = unreleased.split(/^## /m)[0].trim();
      if (!inhalt) {
        probleme.push('Der Branch enthaelt nutzersichtbare Aenderungen (feat/fix), aber `## [Unreleased]` im CHANGELOG ist leer.\nEintrag aus Nutzersicht ergaenzen — oder, wenn wirklich nichts sichtbar ist, die Commits als chore/refactor kennzeichnen.');
      }
    }
    const versionJetzt = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const versionBasis = lauf(`git show ${basis.ausgabe.trim()}:package.json`);
    if (versionBasis.ok) {
      try {
        if (JSON.parse(versionBasis.ausgabe).version === versionJetzt) {
          probleme.push(`Version steht unveraendert auf ${versionJetzt}, obwohl der Branch nutzersichtbare Aenderungen enthaelt. Patch fuer Fixes, Minor fuer Features.`);
        }
      } catch { /* Basis unlesbar -> Pruefung entfaellt */ }
    }
  }
}

// 5. Doku-Budget. Nicht die Schwelle anheben, sondern auslagern.
if (existsSync('CLAUDE.md')) {
  const groesse = readFileSync('CLAUDE.md', 'utf8').length;
  if (groesse > CLAUDE_MD_BUDGET) {
    probleme.push(`CLAUDE.md ist ${groesse} Zeichen gross, Budget sind ${CLAUDE_MD_BUDGET}. Die Datei liegt in jeder Nachricht im Kontext.\nInhalte auslagern (Skill, Issue, Code-Kommentar) statt das Budget anzuheben.`);
  }
}

if (probleme.length === 0) process.exit(0);

console.error(
  `Schleuse: ${probleme.length} Punkt(e) offen, bevor diese Arbeit den Branch verlaesst.\n\n` +
    probleme.map((p, i) => `${i + 1}. ${p}`).join('\n\n') +
    '\n\nDas ist eine mechanische Pruefung, keine Meinung. Punkte beheben und den Befehl erneut ausfuehren.',
);
process.exit(2);
