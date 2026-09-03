# Vision Ark — landing page

Sito statico in **Astro 7**. Una pagina (`/`), una bozza di informativa privacy
(`/privacy`) e un 404. Nessun framework UI, nessun Tailwind: CSS con token e
stili scoped per componente.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # anteprima della build
npx astro check  # type check
```

---

## Come è fatta

```
Dockerfile                  ← build Astro + nginx, per Coolify
tokens.css                  ← palette, tipografia, spazi, motion. Unica fonte di verità.
src/
  styles/global.css         ← reset, impalcatura, bottoni, classi ricorrenti
  layouts/Base.astro        ← <head>, meta, font, skip-link
  pages/
    index.astro             ← assembla le sezioni
    privacy.astro           ← bozza informativa (da completare)
    404.astro               ← pagina non trovata
  components/
    Nav.astro               ← barra sticky, wordmark + CTA
    Hero.astro              ← titolo + render, diptych 7/5
    Manifesto.astro         ← fascia grafite, claim + prosa
    Duality.astro           ← Casa / Attività, due righe che alternano il lato
    Servizi.astro           ← schede tecniche Interni / Esterni
    Metodo.astro            ← le tre fasi 01/02/03
    Garanzie.astro          ← la triade di chiusura
    Preventivo.astro        ← il configuratore
    Footer.astro            ← testata di chiusura
  data/preventivo.ts        ← LE DOMANDE DEL FORM  ← si modifica qui
  scripts/preventivo.ts     ← passi, validazione, invio
  assets/img/               ← i 5 render (Astro li ottimizza in webp)
```

**Ogni colore e ogni font passano da un token.** Nei componenti non ci sono
valori esadecimali né `font-family` inline: se serve un valore nuovo, prima si
aggiunge a `tokens.css`, poi si usa con `var(--nome)`. È quello che tiene il
sito coerente dopo dieci modifiche.

---

## Aggiungere una domanda al preventivo

Si tocca **solo** `src/data/preventivo.ts`. Markup, navigazione fra i passi,
validazione, messaggi d'errore e corpo della mail si adeguano da sé.

Aggiungere un passo intero:

```ts
{
  id: "tempi",
  tag: "I tempi",          // etichetta nell'indicatore di avanzamento
  question: "Quando vorresti iniziare?",
  note: "Una stima basta.",
  fields: [
    {
      kind: "choice",
      name: "tempi",       // chiave del campo inviata al relay
      label: "Tempi",      // etichetta nel riepilogo della mail
      required: true,
      options: [
        { value: "Entro 3 mesi", label: "Entro 3 mesi" },
        { value: "Entro l'anno", label: "Entro l'anno", note: "C'è tempo per progettare bene." },
      ],
    },
  ],
}
```

Aggiungere un campo a un passo esistente: si infila un oggetto nel suo array
`fields`.

Tipi di campo disponibili:

| `kind`     | Cosa rende                                                     | Opzioni utili                        |
| ---------- | -------------------------------------------------------------- | ------------------------------------ |
| `choice`   | card selezionabili (radio, o checkbox con `multiple: true`)     | `options[]`, `multiple`, `hint`      |
| `text`     | campo di testo                                                  | `placeholder`, `autocomplete`, `span` |
| `email`    | come `text`, con validazione del formato                        | idem                                 |
| `tel`      | come `text`, chiede almeno 8 cifre                              | idem                                 |
| `textarea` | testo lungo                                                     | `rows`, `placeholder`                |
| `consent`  | spunta di consenso                                              | `required`                           |

`span: 2` fa occupare al campo la riga intera; senza, sta a metà riga.
`required: true` lo rende obbligatorio per passare al passo successivo.

---

## Collegare l'invio del modulo

L'invio non passa da un servizio nel browser: va a **form-relay**, il servizio
condiviso che gira sulla VPS Twobee (progetto separato, `../form-relay`). Qui
non ci sono chiavi segrete — la chiave del provider di posta sta sul server.

```bash
cp .env.example .env
```

```
PUBLIC_FORM_RELAY_URL=https://moduli.twobee.it
PUBLIC_FORM_RELAY_SITE=vision-ark
```

Il sito manda al relay un oggetto con i valori, le etichette e l'ordine dei
campi. È il motivo per cui il relay resta generico: aggiungi una domanda in
`src/data/preventivo.ts` e la mail si adegua da sé, senza toccare il server.

```json
{
  "fields":  { "tipo_immobile": "Casa", "nome": "…", "_hp": "", "_ts": "1757…" },
  "labels":  { "tipo_immobile": "Tipo di immobile", "nome": "Nome e cognome" },
  "order":   ["tipo_immobile", "ambienti", "nome"],
  "meta":    { "page": "https://visionark.it/#preventivo" }
}
```

`_hp` è l'honeypot (resta vuoto) e `_ts` l'istante di caricamento della pagina:
il relay li usa per riconoscere i bot e non li mette nella mail.

Perché non EmailJS: il piano gratuito è di 200 richieste al mese e 2 template
per account, e le chiavi finiscono nel JavaScript della pagina. Il relay
condiviso non ha limiti di template, tiene le chiavi sul server e serve tutti i
siti dell'agenzia. Il perché nel dettaglio sta nel README di `form-relay`.

Se le variabili non sono impostate, il form funziona fino all'ultimo passo e
poi lo dice esplicitamente: non fallisce in silenzio.

---

---

## Deploy su Coolify

Build pack **Dockerfile** (non Nixpacks), porta esposta **4321**, come gli altri
progetti Twobee. Il `Dockerfile` in root fa tutto: build con Node 22 Alpine,
serve con nginx.

### Le variabili vanno come BUILD VARIABLE

Questa è la differenza rispetto ai progetti precedenti, e se si sbaglia il
sintomo è subdolo: il sito funziona, ma il modulo dice «invio non configurato».

Astro **inlinea le `PUBLIC_*` nel bundle durante `npm run build`**. Non le legge
a runtime. Su Coolify vanno spuntate come *Build Variable*:

| variabile | valore | tipo |
| --- | --- | --- |
| `PUBLIC_FORM_RELAY_URL` | `https://moduli.twobee.it` | **Build** |
| `PUBLIC_FORM_RELAY_SITE` | `vision-ark` | **Build** |

Se mancano, la build stampa un avviso a tutta larghezza nei log di Coolify: il
sito si costruisce comunque, ma il modulo non invia. Non fallisce in silenzio.

### Il lockfile

`package-lock.json` può restare committato. Il salvagente contro i binari
nativi sbagliati non è il gitignore: è la riga `COPY package.json ./` del
Dockerfile, che non copia il lockfile nel container. L'`npm install` dentro
l'immagine parte pulito e prende i binari Linux di rolldown e sharp.

### Prova in locale prima di pushare

```bash
npm run build     # deve passare

docker build \
  --build-arg PUBLIC_FORM_RELAY_URL=https://moduli.twobee.it \
  --build-arg PUBLIC_FORM_RELAY_SITE=vision-ark \
  -t vision-ark:test .

docker run --rm -p 4321:4321 vision-ark:test
```

Poi verifica che l'endpoint sia finito davvero nel bundle — è il controllo che
becca la variabile messa come runtime invece che come build:

```bash
docker run --rm vision-ark:test sh -c \
  'grep -ql moduli.twobee.it /usr/share/nginx/html/_astro/*.js && echo ok || echo MANCA'
```

nginx serve `/`, `/privacy/` e un 404 vero con pagina propria (`/404.html`),
non un rimando alla home: il sito ha più pagine, non è una SPA. Gli asset con
hash sotto `/_astro/` sono cacheati un anno con `immutable`.

## Cosa manca prima di pubblicare

Nel footer e nella pagina privacy i segnaposto sono marcati in ottone fra
parentesi quadre (`[ Telefono da inserire ]`), così è impossibile pubblicarli
per distrazione. Vanno sostituiti:

- **Footer** — telefono, sede, P. IVA, e l'indirizzo email vero (ora è
  `info@visionark.it`, anche nel `<noscript>` di `Preventivo.astro`).
- **`form-relay`** — la voce `vision-ark` nel `config.json` sulla VPS, col
  destinatario vero e le origini di produzione.
- **`/privacy`** — titolare del trattamento, tempi di conservazione, data di
  aggiornamento. Il form raccoglie dati personali: questa pagina serve davvero.
- **`src/pages/index.astro`** — nello schema JSON-LD: `url`, `telephone`,
  `address`, `vatID`, `logo`.
- **`astro.config.mjs`** — impostare `site: 'https://...'` col dominio reale,
  serve per canonical e sitemap.

Contenuti da confermare con il cliente:

- L'elenco dei lavori sotto **Casa** in `Duality.astro` è dedotto: la brochure
  parla solo di strutture ricettive.
- Le tre righe di rassicurazione accanto al form (`Preventivo.astro`) —
  «Rispondiamo entro 2 giorni lavorativi», «Il sopralluogo serve prima del
  numero» — sono promesse operative: vanno confermate o cambiate.
- **Non ci sono render di esterni** e **non ci sono render residenziali**: la
  sezione Esterni è oggi solo tipografica e i due render usati per «Casa» sono i
  più plausibili fra quelli disponibili. Con foto di cantieri veri si aggiunge
  una sezione Lavori.

---

## Note di design

Le scelte strutturali sono registrate nell'intestazione di `tokens.css` e in
`.hallmark/log.json`: macrostruttura Split Studio, tema custom derivato dalla
brochure, display Bricolage Grotesque, body Geist, mono Geist Mono per numerali
ed etichette.

Tre sole animazioni in tutta la pagina: l'ingresso dell'hero al carico, la
pressione dei bottoni, il cambio di passo del form. Tutte rispettano
`prefers-reduced-motion`.

Il sito non carica nessuna libreria di terze parti: zero dipendenze runtime,
solo i font autoospitati. Il bundle JavaScript della pagina è il configuratore
del preventivo e nient'altro.
