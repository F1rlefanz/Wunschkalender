import { afterEach, beforeEach, expect, test } from 'vitest';
import { anmelden, erzeugeTestumgebung, type Testumgebung } from './testhilfe';
import { heutigerTag } from '../sperrfrist';

let u: Testumgebung;

/** Ein Monat, dessen Stichtag ausdruecklich in der Zukunft liegt — offen. */
const OFFEN = '2099-06';
/** Ein Monat, dessen Stichtag ausdruecklich in der Vergangenheit liegt — zu. */
const GESPERRT = '2020-01';

beforeEach(async () => {
  u = await erzeugeTestumgebung();
  // Ausdrueckliche Stichtage statt gerechneter: Damit haengt kein Test daran,
  // welcher Tag heute ist.
  u.store.setStichtag(OFFEN, '2099-12-31');
  u.store.setStichtag(GESPERRT, '2020-01-01');
});

afterEach(() => u.schliessen());

test('ein Wunsch gehoert der angemeldeten Person, egal was im Koerper steht', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.post('/api/wishes').send({
    date: `${OFFEN}-15`,
    shiftType: 'Früh',
    comment: '',
    userId: u.leitung.id, // untergeschoben
  });

  // strictObject weist das Feld ab — und selbst wenn nicht, zaehlt die Sitzung.
  expect(antwort.status).toBe(400);
});

test('ohne untergeschobenes Feld traegt der Wunsch die eigene Kennung', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .post('/api/wishes')
    .send({ date: `${OFFEN}-15`, shiftType: 'Früh', comment: 'bitte' });

  expect(antwort.status).toBe(200);
  expect(antwort.body.userId).toBe(u.mitarbeit.id);
  expect(antwort.body.shiftType).toBe('Früh');
});

test('eine unbekannte Schichtart kommt nicht durch', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .post('/api/wishes')
    .send({ date: `${OFFEN}-15`, shiftType: 'Zwischendienst', comment: '' });
  expect(antwort.status).toBe(400);
});

test('in einen gesperrten Monat schreibt niemand — auch nicht direkt am Endpunkt', async () => {
  // Frueher stand die Sperre nur in der Oberflaeche und war umgehbar.
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .post('/api/wishes')
    .send({ date: `${GESPERRT}-15`, shiftType: 'Frei', comment: '' });
  expect(antwort.status).toBe(403);
});

test('die Leitung ist von der Sperrfrist ausgenommen', async () => {
  const agent = await anmelden(u.app, u.leitung.name);
  const antwort = await agent
    .post('/api/wishes')
    .send({ date: `${GESPERRT}-15`, shiftType: 'Frei', comment: '' });
  expect(antwort.status).toBe(200);
});

test('am Stichtag selbst ist der Monat noch offen, am Tag danach nicht', async () => {
  // "Bis einschliesslich" — die Regel, die am leichtesten um einen Tag verrutscht.
  // heutigerTag() rechnet in Europe/Berlin — genau wie der Server. Mit
  // new Date().toISOString() waere der Test nachts zwei Stunden lang rot.
  const alsTag = (verschiebung: number) => {
    const [j, m, t] = heutigerTag().split('-').map(Number);
    return new Date(Date.UTC(j, m - 1, t + verschiebung)).toISOString().slice(0, 10);
  };

  u.store.setStichtag('2098-05', alsTag(0));
  const agent = await anmelden(u.app, u.mitarbeit.name);
  await agent.post('/api/wishes').send({ date: '2098-05-10', shiftType: 'Früh', comment: '' }).expect(200);

  u.store.setStichtag('2098-06', alsTag(-1));
  const danach = await agent
    .post('/api/wishes')
    .send({ date: '2098-06-10', shiftType: 'Früh', comment: '' });
  expect(danach.status).toBe(403);
});

test('fremde Wuensche loescht nur die Leitung', async () => {
  const mitarbeitAgent = await anmelden(u.app, u.mitarbeit.name);
  const wunsch = await mitarbeitAgent
    .post('/api/wishes')
    .send({ date: `${OFFEN}-15`, shiftType: 'Früh', comment: '' });

  const leitungAgent = await anmelden(u.app, u.leitung.name);
  const eigenerDerLeitung = await leitungAgent
    .post('/api/wishes')
    .send({ date: `${OFFEN}-16`, shiftType: 'Nacht', comment: '' });

  // Mitarbeitende an fremdem Wunsch: nein.
  const verboten = await mitarbeitAgent.delete(`/api/wishes/${eigenerDerLeitung.body.id}`);
  expect(verboten.status).toBe(403);

  // Leitung an fremdem Wunsch: ja.
  const erlaubt = await leitungAgent.delete(`/api/wishes/${wunsch.body.id}`);
  expect(erlaubt.status).toBe(200);
});

test('auch das Loeschen faellt unter die Sperrfrist', async () => {
  // Sonst verschwaende ein Wunsch nachtraeglich aus einem Monat, den die
  // Leitung bereits bearbeitet.
  const wunsch = u.store.addWish({
    userId: u.mitarbeit.id,
    date: `${GESPERRT}-15`,
    shiftType: 'Frei',
    comment: '',
  });
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.delete(`/api/wishes/${wunsch.id}`);
  expect(antwort.status).toBe(403);
});

test('ein Monatshinweis gehoert der angemeldeten Person und ersetzt den vorigen', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  await agent.post('/api/monthly-comments').send({ month: OFFEN, text: 'erst' }).expect(200);
  const zweiter = await agent.post('/api/monthly-comments').send({ month: OFFEN, text: 'dann' });

  expect(zweiter.status).toBe(200);
  expect(zweiter.body.userId).toBe(u.mitarbeit.id);
  const alle = u.store.listMonthlyComments().filter((c) => c.userId === u.mitarbeit.id);
  expect(alle).toHaveLength(1);
  expect(alle[0].text).toBe('dann');
});

test('ein Monatshinweis in einem gesperrten Monat wird abgewiesen', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.post('/api/monthly-comments').send({ month: GESPERRT, text: 'zu spaet' });
  expect(antwort.status).toBe(403);
});
