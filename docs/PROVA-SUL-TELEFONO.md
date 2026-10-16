# Provare Speow! sul telefono (solo cloud, niente PC)

Servono due cose, entrambe nel cloud e **gratuite** (nessuna carta richiesta per la prova):

1. **Il server** su **Render** (piano Free) e **il database** su **Neon** (piano Free): account separati da Railway, quindi nessun impatto su altre app.
2. **L'APK** Android: lo costruisce **GitHub Actions** automaticamente e lo trovi in
   [Releases → android-test](https://github.com/davedegrado/Zynk/releases/tag/android-test).

Limiti dei piani gratuiti (vanno bene per provare):
- Render Free: il server **si addormenta dopo 15 minuti** senza richieste; il primo accesso dopo una pausa impiega **circa 1 minuto**. 750 ore/mese incluse.
- Neon Free: 0,5 GB di dati, 100 ore di calcolo/mese, il database si sospende da solo dopo 5 minuti di inattività (si risveglia in un istante). Non scade.

## 1a. Database su Neon (circa 3 minuti)

1. Vai su https://neon.com → **Sign up** con GitHub.
2. Crea un progetto (nome: `speow`, regione: **Europe (Frankfurt)**).
3. Nella dashboard premi **Connect** e copia la **connection string**
   (inizia con `postgresql://…neon.tech/neondb?sslmode=require…`). Tienila da parte: è una password, non condividerla.

## 1b. Server su Render (circa 5 minuti)

1. Vai su https://render.com → **Sign up** con GitHub.
2. **New → Blueprint** → collega il repository `davedegrado/Zynk`.
   Render trova `render.yaml` e propone il servizio **speow-api** (piano Free).
3. Quando chiede **DATABASE_URL**, incolla la connection string di Neon. Premi **Apply**.
4. Attendi il deploy (5–10 minuti la prima volta). In alto trovi l'indirizzo, tipo `https://speow-api.onrender.com`.
5. Aprilo con `/health` alla fine: deve rispondere `{"ok":true,...}` (la prima volta può impiegare un minuto).

Mandami quell'indirizzo: lo inserisco nell'APK, così l'app si collega da sola.

## 2. Installare l'APK

1. Dal telefono apri [Releases → android-test](https://github.com/davedegrado/Zynk/releases/tag/android-test) e scarica `speow-test.apk`.
2. Aprilo: Android chiede di consentire l'installazione dal browser ("origini sconosciute"). Accetta e installa.
3. Apri Speow! e crea un account.
   Se l'APK non ha ancora l'indirizzo del server, tocca **Set server address** e incolla l'indirizzo di Render.

Per provare uno Speow vero servono due account amici (es. due telefoni): aggiungetevi da **Add** cercando lo username.

## Cosa non c'è in questa build di prova

- **Notifiche push**: servono Firebase (Android) e un account Apple. Gli Speow arrivano comunque con l'app aperta.
- **Acquisti Plus**: servono gli store e RevenueCat.
- **iPhone**: serve un account Apple Developer (99 $/anno) per installare app fuori dall'App Store.

## Problemi comuni

| Problema | Soluzione |
|---|---|
| L'app dice "Can't reach…" | Il server gratuito forse dormiva: riprova dopo un minuto. Controlla che `…/health` risponda e che su Render `DATABASE_URL` sia impostata |
| Android blocca l'installazione | Impostazioni → App → (il tuo browser) → Installa app sconosciute → consenti |
| "App non installata" | Disinstalla una versione precedente di Speow! (firma diversa) e riprova |
