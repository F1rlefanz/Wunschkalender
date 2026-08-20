/**
 * Prueft, ob der Changelog fuer die Commits eines Branches etwas hergibt.
 *
 * Die frueher gestellte Frage war „steht etwas unter `## [Unreleased]`?" — die ist
 * falsch, sobald eine Version datiert wird: Dann wandern genau diese Eintraege unter
 * eine Ueberschrift wie `## [0.4.0] – 2026-08-20` und `[Unreleased]` bleibt leer
 * zurueck (Issue #34). Was zaehlt, ist ein Eintrag **zu diesen Commits**, nicht die
 * Ueberschrift darueber. Deshalb wird der Changelog gegen den Stand der
 * Vergleichsbasis gehalten: Was dort noch nicht stand, ist neu.
 */

/** Eintraege eines Changelogs, Fortsetzungszeilen an ihren Eintrag angehaengt. */
const eintraege = (changelog) => {
  if (!changelog) return [];

  const gesammelt = [];
  let offen = null;
  const schliessen = () => {
    if (offen) gesammelt.push(offen.replace(/\s+/g, ' ').trim());
    offen = null;
  };

  // Erst ab der ersten `## `-Ueberschrift. Davor stehen die Kopfregeln, und deren
  // Aufzaehlungen sind keine Changelog-Eintraege.
  let imAbschnitt = false;
  for (const zeile of changelog.split(/\r?\n/)) {
    if (/^#{1,3} /.test(zeile)) {
      schliessen();
      if (/^## /.test(zeile)) imAbschnitt = true;
      continue;
    }
    if (!imAbschnitt) continue;

    if (/^[-*] /.test(zeile)) {
      schliessen();
      offen = zeile;
    } else if (offen && /^\s+\S/.test(zeile)) {
      offen += ` ${zeile.trim()}`;
    } else {
      schliessen();
    }
  }
  schliessen();

  return gesammelt;
};

/**
 * Eintraege, die im neuen Changelog stehen und im alten noch nicht — unabhaengig davon,
 * unter welcher Ueberschrift. Ein wortgleich verdoppelter Eintrag zaehlt einmal als neu.
 *
 * @param {string|null} vorher Changelog auf der Vergleichsbasis, `null` wenn es keinen gab.
 * @param {string} nachher Changelog auf diesem Branch.
 * @returns {string[]} die neuen Eintraege, leer wenn keiner hinzukam.
 */
export const neueChangelogEintraege = (vorher, nachher) => {
  const alt = new Map();
  for (const eintrag of eintraege(vorher)) alt.set(eintrag, (alt.get(eintrag) ?? 0) + 1);

  const neu = [];
  for (const eintrag of eintraege(nachher)) {
    const uebrig = alt.get(eintrag) ?? 0;
    if (uebrig > 0) alt.set(eintrag, uebrig - 1);
    else neu.push(eintrag);
  }
  return neu;
};
