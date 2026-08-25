import { afterEach, beforeEach, expect, test } from 'vitest';
import { anmelden, erzeugeTestumgebung, type Testumgebung } from './testhilfe';
import { VORGABE_VORLAUF_TAGE } from '../sperrfrist';

let u: Testumgebung;

beforeEach(async () => {
  u = await erzeugeTestumgebung();
});

afterEach(() => u.schliessen());

test('alle duerfen die Einstellungen lesen', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.get('/api/settings');
  expect(antwort.status).toBe(200);
  expect(antwort.body.vorlaufTage).toBe(VORGABE_VORLAUF_TAGE);
});

test('nur die Leitung darf sie aendern', async () => {
  const mitarbeit = await anmelden(u.app, u.mitarbeit.name);
  expect((await mitarbeit.post('/api/settings').send({ vorlaufTage: 30 })).status).toBe(403);

  const leitung = await anmelden(u.app, u.leitung.name);
  expect((await leitung.post('/api/settings').send({ vorlaufTage: 30 })).status).toBe(200);
  expect(u.store.getSettings().vorlaufTage).toBe(30);
});

test('nur die Leitung darf Stichtage setzen und loeschen', async () => {
  const mitarbeit = await anmelden(u.app, u.mitarbeit.name);
  expect((await mitarbeit.put('/api/stichtage/2099-06').send({ datum: '2099-05-01' })).status).toBe(403);

  const leitung = await anmelden(u.app, u.leitung.name);
  expect((await leitung.put('/api/stichtage/2099-06').send({ datum: '2099-05-01' })).status).toBe(200);
  expect(u.store.getSettings().stichtage['2099-06']).toBe('2099-05-01');

  expect((await leitung.delete('/api/stichtage/2099-06')).status).toBe(200);
  expect(u.store.getSettings().stichtage['2099-06']).toBeUndefined();
});

test('ein gesetzter Stichtag ueberlebt eine Aenderung des Vorlaufs', async () => {
  // Der Vorschlag ist Rueckfallebene, keine laufende Korrektur (#36).
  const leitung = await anmelden(u.app, u.leitung.name);
  await leitung.put('/api/stichtage/2099-06').send({ datum: '2099-05-01' }).expect(200);
  await leitung.post('/api/settings').send({ vorlaufTage: 14 }).expect(200);

  expect(u.store.getSettings().stichtage['2099-06']).toBe('2099-05-01');
});

test('ein unsinniger Monat im Pfad wird abgewiesen', async () => {
  const leitung = await anmelden(u.app, u.leitung.name);
  const antwort = await leitung.put('/api/stichtage/Juni-2099').send({ datum: '2099-05-01' });
  expect(antwort.status).toBe(400);
});
