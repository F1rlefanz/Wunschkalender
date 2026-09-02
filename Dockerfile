# Ein Abbild als gemeinsames Fundament: dieselbe Verpackung fuer die
# Testfassung und fuer die spaetere Aufstellung im Haus. Siehe docs/betrieb.md.
#
# Beide Stufen benutzen dieselbe Debian-Grundlage. `better-sqlite3` und
# `@node-rs/argon2` sind native Module — ihre gebauten Binaerdateien passen nur
# zu derselben Node-Fassung und derselben C-Bibliothek. Deshalb wird
# `node_modules` aus der Bau-Stufe **kopiert** und nicht neu installiert.

FROM node:24-bookworm AS bau
WORKDIR /app

# Playwright wird hier nicht gebraucht; ohne diese Zeile laedt die Installation
# einen kompletten Browser mit, der nie benutzt wird.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && npm prune --omit=dev

FROM node:24-bookworm-slim AS laufzeit
WORKDIR /app

ENV NODE_ENV=production
# Die Daten liegen ausserhalb des Abbilds. Ohne einen Datentraeger an dieser
# Stelle sind sie beim naechsten Start weg — das ist fuer die Testfassung
# gewollt, fuer den Echtbetrieb nicht.
ENV DATEN_ORDNER=/daten

COPY --from=bau /app/node_modules ./node_modules
COPY --from=bau /app/dist ./dist
COPY --from=bau /app/package.json ./package.json

# Nicht als root. Das ist im Krankenhausnetz kein Schmuck, sondern die
# Erwartung. `node` ist im Grundabbild bereits angelegt.
RUN mkdir -p /daten && chown -R node:node /daten /app
USER node

EXPOSE 3000
VOLUME ["/daten"]

# Einen Health-Endpunkt gibt es noch nicht (Issue #4); bis dahin ist die
# ausgelieferte Oberflaeche der Beleg, dass der Prozess wirklich antwortet.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(a=>process.exit(a.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
