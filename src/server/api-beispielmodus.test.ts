import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { erzeugeApp } from './app';
import { createDatabase } from './database';
import { BEISPIEL_KONTEN, BEISPIEL_PASSWORT } from './beispieldaten';

async function app(beispielmodus: boolean) {
  const db = createDatabase(':memory:');
  const { app } = await erzeugeApp({
    db,
    sitzungsgeheimnis: 'geheimnis-nur-fuer-tests',
    betrieb: { proxyHops: 0, hsts: false, warnung: null },
    auslieferung: 'keine',
    beispielmodus,
  });
  return app;
}

describe('GET /api/beispielmodus', () => {
  test('ist ohne Anmeldung erreichbar — die Anmeldeseite braucht die Auskunft', async () => {
    const antwort = await request(await app(false)).get('/api/beispielmodus');

    expect(antwort.status).toBe(200);
    expect(antwort.body).toEqual({ an: false });
  });

  test('nennt im Beispielmodus die Zugangsdaten', async () => {
    const antwort = await request(await app(true)).get('/api/beispielmodus');

    expect(antwort.status).toBe(200);
    expect(antwort.body.an).toBe(true);
    expect(antwort.body.passwort).toBe(BEISPIEL_PASSWORT);
    expect(antwort.body.konten).toHaveLength(BEISPIEL_KONTEN.length);
  });

  test('verraet im Echtbetrieb weder Konten noch Passwort', async () => {
    const antwort = await request(await app(false)).get('/api/beispielmodus');

    expect(JSON.stringify(antwort.body)).not.toContain(BEISPIEL_PASSWORT);
    expect(antwort.body.konten).toBeUndefined();
  });

  test('oeffnet keine anderen Wege — /api/wishes bleibt ohne Sitzung gesperrt', async () => {
    const antwort = await request(await app(true)).get('/api/wishes');

    expect(antwort.status).toBe(401);
  });
});
