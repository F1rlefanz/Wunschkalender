import { describe, expect, test } from 'vitest';
import { leseBetriebsmodus } from './betriebsmodus';

describe('leseBetriebsmodus', () => {
  test('vertraut ohne Angabe keinem Proxy', () => {
    const modus = leseBetriebsmodus({});

    expect(modus.proxyHops).toBe(0);
    expect(modus.hsts).toBe(false);
  });

  test('uebernimmt die Anzahl der Proxy-Hops', () => {
    expect(leseBetriebsmodus({ VERTRAUE_PROXY: '2' }).proxyHops).toBe(2);
  });

  test('behandelt unsinnige Angaben wie keinen Proxy', () => {
    for (const wert of ['', 'ja', '-1', '1,5']) {
      expect(leseBetriebsmodus({ VERTRAUE_PROXY: wert }).proxyHops).toBe(0);
    }
  });

  test('schaltet HSTS nur auf ausdrueckliche Ansage ein', () => {
    expect(leseBetriebsmodus({ HSTS: '1' }).hsts).toBe(true);
    expect(leseBetriebsmodus({ HSTS: 'an' }).hsts).toBe(true);
    expect(leseBetriebsmodus({ HSTS: '0' }).hsts).toBe(false);
    expect(leseBetriebsmodus({ HSTS: '' }).hsts).toBe(false);
  });

  test('warnt im Produktivbetrieb, wenn weder Proxy noch HSTS gesetzt sind', () => {
    const modus = leseBetriebsmodus({ NODE_ENV: 'production' });

    expect(modus.warnung).toMatch(/unverschluesselt/i);
  });

  test('warnt nicht, wenn hinter einem Proxy mit HSTS betrieben', () => {
    const modus = leseBetriebsmodus({
      NODE_ENV: 'production',
      VERTRAUE_PROXY: '1',
      HSTS: '1',
    });

    expect(modus.warnung).toBeNull();
  });

  test('warnt in der Entwicklung nicht', () => {
    expect(leseBetriebsmodus({}).warnung).toBeNull();
  });

  test('warnt, wenn HSTS ohne vertrauten Proxy gesetzt ist', () => {
    const modus = leseBetriebsmodus({ NODE_ENV: 'production', HSTS: '1' });

    expect(modus.warnung).toMatch(/proxy/i);
  });
});
