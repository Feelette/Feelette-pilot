# Feelette Pilot — Real Group Version

Viidelle ystävälle. Oikeat käyttäjät, oikeat ryhmät, oikeat aikalahjat.

## Rakenne

- `backend/` — Node.js + PostgreSQL, deploy Railwayhin
- `frontend/index.html` — Yhden tiedoston sovellus, deploy Netlifyyn

## 1. Deployaa backend Railwayhin

1. Lataa feelette-pilot-kansio GitHubiin uutena repositoriona (nimi esim. `feelette-pilot`)
2. Mene Railway-projektiisi
3. **New** → **GitHub Repo** → valitse feelette-pilot
4. **Settings** → **Service Source** → **Root Directory**: `backend`
5. Lisää **PostgreSQL** samaan projektiin (uusi kanta, älä käytä vanhan päälle)
6. **Variables** → lisää:
   - `DATABASE_URL` (kopioi uuden Postgresin Variables-välilehdeltä)
   - `CORS_ORIGIN` = `*`
7. **Settings** → **Deploy** → **Start Command**: `node db/init.js` → tallenna, odota
8. Vaihda **Start Command** takaisin: `node server.js` → tallenna
9. **Settings** → **Networking** → **Generate Domain**
10. Testaa: `https://<osoite>/health` → pitäisi näkyä `{"ok":true}`

## 2. Päivitä frontend

Avaa `frontend/index.html` ja etsi rivi:
```javascript
const API_BASE = 'https://feelette-pilot-production.up.railway.app';
```
Vaihda siihen oma Railway-osoitteesi.

## 3. Deployaa frontend Netlifyyn

- Mene netlify.com → raahaa `frontend`-kansio hallintapaneeliin
- Saat osoitteen, esim. `https://feelette-pilot.netlify.app`

## 4. Kutsu ystäviä

Lähetä viesti:

> Hei! Testaan uutta Feelette-sovellusta. Avaa tämä linkki puhelimella: https://SINUN-NETLIFY-OSOITE.netlify.app
> 
> Syötä:
> - Nimesi
> - 3-numeroinen koodi (mikä tahansa, muista se jos haluat kirjautua takaisin)
> - Ryhmäkoodi: pilot
> - Oma väri (perhe/ystävät/työ/joukkue)
>
> Siinä kaikki. Liikuta palloa kertoaksesi miltä sinusta tuntuu. Paina muiden palloja antaaksesi heille aikaa.

## API

- `GET /health` — health check
- `POST /api/users/login` — kirjaudu tai luo käyttäjä
- `POST /api/users/:id/state` — päivitä oma "how are you" arvo
- `GET /api/groups/:code/members` — listaa ryhmän jäsenet
- `POST /api/gifts` — anna aikaa
- `GET /api/gifts/received/:user_id?since=<iso>` — uudet saadut aikalahjat (polling)
- `GET /api/gifts/history/:user_id` — viikon historia
