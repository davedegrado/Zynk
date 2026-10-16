# Provare Speow! sul telefono (solo cloud, niente PC)

Servono due cose, entrambe nel cloud:

1. **Il server** (API + database) su **Railway**: lo attivi tu dal browser, anche dal telefono.
2. **L'APK** Android: lo costruisce **GitHub Actions** automaticamente e lo trovi in
   [Releases → android-test](https://github.com/davedegrado/Zynk/releases/tag/android-test).

## 1. Server su Railway (circa 5 minuti)

1. Vai su https://railway.com e accedi con **GitHub**. Scegli il piano **Hobby** (5 $/mese, include 5 $ di consumo).
2. **New Project → Deploy from GitHub repo →** `davedegrado/Zynk`.
   Railway legge `railway.json` e costruisce il server da solo. Il primo deploy può fallire finché non c'è il database: è normale.
3. Nel progetto: **+ Create → Database → Add PostgreSQL**.
4. Apri il servizio **Zynk** (il server) → **Variables → New Variable**:
   - nome `DATABASE_URL`, valore `${{Postgres.DATABASE_URL}}`
   (Railway propone il riferimento in automatico mentre scrivi.) Salva: riparte il deploy.
5. Sempre nel servizio: **Settings → Networking → Generate Domain** (se chiede la porta, lascia quella che Railway rileva).
   Ottieni un indirizzo tipo `https://zynk-production-xxxx.up.railway.app`.
6. Apri `https://…up.railway.app/health` nel browser: deve rispondere `{"ok":true,...}`.

Mandami quell'indirizzo: lo inserisco nell'APK, così l'app si collega da sola.

## 2. Installare l'APK

1. Dal telefono apri [Releases → android-test](https://github.com/davedegrado/Zynk/releases/tag/android-test) e scarica `speow-test.apk`.
2. Aprilo: Android chiede di consentire l'installazione dal browser ("origini sconosciute"). Accetta e installa.
3. Apri Speow! e crea un account.
   Se l'APK non ha ancora l'indirizzo del server, tocca **Set server address** e incolla l'indirizzo di Railway.

Per provare uno Speow vero servono due account amici (es. due telefoni): aggiungetevi da **Add** cercando lo username.

## Cosa non c'è in questa build di prova

- **Notifiche push**: servono Firebase (Android) e un account Apple. Gli Speow arrivano comunque con l'app aperta.
- **Acquisti Plus**: servono gli store e RevenueCat.
- **iPhone**: serve un account Apple Developer (99 $/anno) per installare app fuori dall'App Store.

## Problemi comuni

| Problema | Soluzione |
|---|---|
| L'app dice "Can't reach…" | Controlla che `…/health` risponda. Su Railway il servizio deve essere "Active" e avere `DATABASE_URL` |
| Android blocca l'installazione | Impostazioni → App → (il tuo browser) → Installa app sconosciute → consenti |
| "App non installata" | Disinstalla una versione precedente di Speow! (firma diversa) e riprova |
