# Provare Speow! sul telefono

L'app ha bisogno del suo **server** (API + database). Per una prova, il server gira
sul tuo computer e il telefono ci si collega via **Wi-Fi** (stessa rete).

Ci sono due strade:

| | A. Expo Go (consigliata per iniziare) | B. APK installabile |
|---|---|---|
| Tempo | ~10 minuti | ~30 minuti (la build gira nel cloud di Expo) |
| Serve | App **Expo Go** dal Play Store | Account gratuito su expo.dev |
| Il computer deve restare acceso | sì (server + app) | sì, solo per il server |
| Notifiche push | no | no (servono Firebase, vedi SETUP.md) |

In entrambi i casi gli Speow arrivano comunque quando l'app è aperta (Activity si aggiorna ogni pochi secondi).

---

## 1. Prepara il computer (una volta sola)

Installa:
- **Node.js 22** — https://nodejs.org
- **Git** — https://git-scm.com
- **Docker Desktop** — https://www.docker.com/products/docker-desktop (serve per il database)

Poi, in un terminale:

```bash
git clone https://github.com/davedegrado/Zynk.git
cd Zynk
git checkout claude/sleepy-wozniak-nmu6dv
npm install
```

## 2. Avvia il server

```bash
docker compose up -d db                          # database PostgreSQL
cp apps/server/.env.example apps/server/.env     # su Windows: copy apps\server\.env.example apps\server\.env
npm run migrate -w @zynk/server                  # crea le tabelle
npm run cli -w @zynk/server -- seed              # (facoltativo) utenti di prova, password: zynkzynk
npm run dev -w @zynk/server                      # lascia questo terminale aperto
```

Controlla che funzioni aprendo http://localhost:4000/health nel browser: deve dire `{"ok":true,...}`.

**Trova l'indirizzo IP del computer** (ti servirà sul telefono):
- Windows: `ipconfig` → "Indirizzo IPv4", es. `192.168.1.20`
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I`

Se Windows chiede di consentire Node.js sulle reti **private**, accetta (altrimenti il telefono non raggiunge la porta 4000).
Dal telefono puoi verificare aprendo `http://192.168.1.20:4000/health` nel browser.

---

## A. Con Expo Go (senza build)

1. Installa **Expo Go** dal Play Store (o App Store su iPhone).
2. In un secondo terminale:
   ```bash
   cd apps/mobile
   npx expo start --go
   ```
3. Inquadra il QR code con Expo Go (su iPhone con la fotocamera).

L'app trova da sola il server sul tuo computer. Se non lo trova, tocca **Set server address** nella schermata iniziale e scrivi l'IP del computer.

---

## B. L'APK (build gratuita nel cloud di Expo)

1. Crea un account gratuito su https://expo.dev/signup
2. Nel terminale:
   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   `init` stampa un **project ID** (es. `1a2b3c4d-...`). Apri `apps/mobile/app.config.ts` e incollalo qui:
   ```ts
   const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '1a2b3c4d-...';
   ```
3. Avvia la build dell'APK di prova:
   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```
   Alla domanda sul keystore Android rispondi **Yes** (lo genera Expo).
   Dopo ~15–20 minuti ricevi un **link e un QR code** per scaricare l'APK (li trovi anche su expo.dev → il tuo progetto → Builds).
4. Sul telefono apri il link, scarica l'APK e installalo (Android chiederà di consentire l'installazione da "origini sconosciute" per il browser: accetta).
5. Apri Speow!, tocca **Set server address**, scrivi l'IP del computer (es. `192.168.1.20`), **Test connection** → **Save**.
6. Crea un account (o entra con `demo` / `zynkzynk` se hai fatto il seed).

L'APK `preview` è solo per prove: permette HTTP in rete locale e la scelta del server. Le build di produzione usano solo HTTPS.

---

## Provare uno Speow vero

Servono due account amici:
- due telefoni (o telefono + Expo Go su un altro), ognuno con il proprio account; aggiungetevi da **Add** cercando lo username;
- oppure, col seed: entra come `demo` sul telefono, e da un altro dispositivo entra come `sam.rivers` (password `zynkzynk`) e manda uno Speow a Dee Demo.

## Problemi comuni

| Problema | Soluzione |
|---|---|
| "Can't reach …" | Server avviato? Stessa Wi-Fi? Firewall del PC: consenti Node.js / porta 4000. Alcune reti (ospiti, aziendali) isolano i dispositivi: prova l'hotspot del telefono |
| L'IP del computer è cambiato | Nell'app: schermata iniziale → **Server** → nuovo IP (se sei già dentro, fai Log out) |
| Expo Go dice che la versione SDK non è supportata | Aggiorna Expo Go dal Play Store |
| `eas init` chiede di aggiungere il projectId a mano | È normale: incollalo in `app.config.ts` come al punto B.2 |
