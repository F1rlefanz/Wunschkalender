import { createDatabase } from './src/server/database';
import { migrateFromJson } from './src/server/migration';
import { ensureManagerAccount } from './src/server/seed';
import { resolveSessionSecret } from './src/server/session-secret';
import { leseBetriebsmodus } from './src/server/betriebsmodus';
import { MIN_PASSWORD_LENGTH } from './src/server/passwords';
import { erzeugeApp } from './src/server/app';
import { loeseDatenpfade, stelleDatenordnerBereit } from './src/server/daten-ordner';

async function startServer() {
  // Wo die Daten liegen, sagt der Betrieb ueber DATEN_ORDNER; ohne Angabe
  // bleibt es das Arbeitsverzeichnis. Siehe docs/betrieb.md.
  const pfade = loeseDatenpfade(process.env, process.cwd());
  stelleDatenordnerBereit(pfade);

  const db = createDatabase(pfade.datenbank);

  const migration = await migrateFromJson(db, pfade.altJson);
  if (migration.migrated) {
    console.log(
      `Migration abgeschlossen: ${migration.users} Benutzer, ${migration.wishes} Wuensche, ` +
        `${migration.comments} Hinweise aus db.json uebernommen.`,
    );
    for (const warnung of migration.warnings) console.warn(`  Achtung: ${warnung}`);
  }

  const seed = await ensureManagerAccount(db);
  if (seed.created) {
    console.log(
      [
        '',
        '  ┌────────────────────────────────────────────────┐',
        '  │  Erststart: Leitungskonto angelegt             │',
        '  │                                                │',
        `  │    Name:     ${(seed.name ?? '').padEnd(34)}│`,
        `  │    Passwort: ${(seed.password ?? '').padEnd(34)}│`,
        '  │                                                │',
        '  │  Bitte notieren und nach der ersten Anmeldung  │',
        '  │  im Profil aendern.                            │',
        '  │  Diese Meldung erscheint nur einmal.           │',
        '  └────────────────────────────────────────────────┘',
        '',
      ].join('\n'),
    );
  }

  const secret = resolveSessionSecret(pfade.geheimnis, process.env.SESSION_SECRET);
  if (secret.source === 'erzeugt') {
    console.log(`Sitzungsgeheimnis erzeugt und abgelegt unter ${pfade.geheimnis}.`);
  }

  // Wie die Anwendung erreichbar ist, sagt der Betrieb ueber die Umgebung —
  // die Vorgabe ist kein Proxy und kein HSTS. Siehe docs/betrieb.md.
  const betrieb = leseBetriebsmodus(process.env);
  if (betrieb.warnung) console.warn(`WARNUNG: ${betrieb.warnung}`);

  const { httpServer } = await erzeugeApp({
    db,
    sitzungsgeheimnis: secret.secret,
    betrieb,
    auslieferung: process.env.NODE_ENV === 'production' ? 'statisch' : 'vite',
  });

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server laeuft auf Port ${PORT} (Mindestlaenge fuer Passwoerter: ${MIN_PASSWORD_LENGTH}, ` +
        `Sitzungsgeheimnis: ${secret.source}, vertraute Proxys: ${betrieb.proxyHops}, ` +
        `HSTS: ${betrieb.hsts ? 'an' : 'aus'}, Datenordner: ${pfade.ordner})`,
    );
  });
}

startServer();
