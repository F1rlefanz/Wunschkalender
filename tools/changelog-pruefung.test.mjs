import { describe, expect, it } from 'vitest';
import { neueChangelogEintraege } from './changelog-pruefung.mjs';

const kopf = `# Changelog

Alle fuer Nutzerinnen und Nutzer sichtbaren Aenderungen an diesem Projekt.
`;

const mitAbschnitten = (...abschnitte) => kopf + '\n' + abschnitte.join('\n') + '\n';

describe('neueChangelogEintraege', () => {
  it('erkennt einen Eintrag, der unter [Unreleased] hinzugekommen ist', () => {
    const vorher = mitAbschnitten('## [Unreleased]\n', '## [0.3.0] – 2026-08-19\n\n### Hinzugefuegt\n- **Alt.** Text.\n');
    const nachher = mitAbschnitten(
      '## [Unreleased]\n\n### Behoben\n- **Neu.** Text.\n',
      '## [0.3.0] – 2026-08-19\n\n### Hinzugefuegt\n- **Alt.** Text.\n',
    );

    expect(neueChangelogEintraege(vorher, nachher)).toEqual(['- **Neu.** Text.']);
  });

  it('erkennt denselben Eintrag auch unter einer frisch datierten Ueberschrift', () => {
    // Der Ablauf: Eintrag schreiben und Version datieren, beides in einem Push.
    const vorher = mitAbschnitten('## [Unreleased]\n', '## [0.3.0] – 2026-08-19\n\n### Hinzugefuegt\n- **Alt.** Text.\n');
    const nachher = mitAbschnitten(
      '## [Unreleased]\n',
      '## [0.4.0] – 2026-08-20\n\n### Behoben\n- **Neu.** Text.\n',
      '## [0.3.0] – 2026-08-19\n\n### Hinzugefuegt\n- **Alt.** Text.\n',
    );

    expect(neueChangelogEintraege(vorher, nachher)).toEqual(['- **Neu.** Text.']);
  });

  it('zaehlt einen ueberarbeiteten Eintrag als neu', () => {
    const vorher = mitAbschnitten('## [Unreleased]\n\n### Behoben\n- **Alt.** Kurz.\n');
    const nachher = mitAbschnitten('## [Unreleased]\n\n### Behoben\n- **Alt.** Ausfuehrlicher erklaert.\n');

    expect(neueChangelogEintraege(vorher, nachher)).toEqual(['- **Alt.** Ausfuehrlicher erklaert.']);
  });

  it('meldet nichts, wenn nur eine Ueberschrift datiert wurde', () => {
    // Reines Datieren ohne neuen Eintrag ist ein chore-Commit und braucht keinen Eintrag.
    const vorher = mitAbschnitten('## [Unreleased]\n\n### Behoben\n- **Alt.** Text.\n');
    const nachher = mitAbschnitten('## [Unreleased]\n', '## [0.4.0] – 2026-08-20\n\n### Behoben\n- **Alt.** Text.\n');

    expect(neueChangelogEintraege(vorher, nachher)).toEqual([]);
  });

  it('meldet nichts, wenn der Changelog unveraendert blieb', () => {
    const changelog = mitAbschnitten('## [Unreleased]\n\n### Behoben\n- **Alt.** Text.\n');

    expect(neueChangelogEintraege(changelog, changelog)).toEqual([]);
  });

  it('uebersieht einen zweiten, wortgleichen Eintrag nicht', () => {
    const vorher = mitAbschnitten('## [Unreleased]\n\n- **Gleich.** Text.\n');
    const nachher = mitAbschnitten('## [Unreleased]\n\n- **Gleich.** Text.\n- **Gleich.** Text.\n');

    expect(neueChangelogEintraege(vorher, nachher)).toEqual(['- **Gleich.** Text.']);
  });

  it('behandelt eingerueckte Fortsetzungszeilen als Teil des Eintrags, nicht als eigenen', () => {
    const vorher = mitAbschnitten('## [Unreleased]\n');
    const nachher = mitAbschnitten('## [Unreleased]\n\n- **Neu.** Erste Zeile,\n  zweite Zeile.\n');

    expect(neueChangelogEintraege(vorher, nachher)).toEqual(['- **Neu.** Erste Zeile, zweite Zeile.']);
  });

  it('zaehlt alles als neu, wenn es vorher keinen Changelog gab', () => {
    const nachher = mitAbschnitten('## [Unreleased]\n\n- **Neu.** Text.\n');

    expect(neueChangelogEintraege(null, nachher)).toEqual(['- **Neu.** Text.']);
  });
});
