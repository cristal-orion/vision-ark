# Vision Ark — landing page

Sito statico in **Astro 7**. Una pagina (`/`), l'informativa privacy
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
    privacy.astro           ← informativa privacy
    404.astro               ← pagina non trovata
  components/
    Nav.astro               ← barra sticky, wordmark + CTA
    Hero.astro              ← confronto disegno/render con testo a scomparsa
    Manifesto.astro         ← fascia grafite, claim + prosa
    Duality.astro           ← Casa / Attività, due righe che alternano il lato
    Servizi.astro           ← schede tecniche Interni / Esterni
    Metodo.astro            ← le tre fasi 01/02/03
    Garanzie.astro          ← la triade di chiusura
    Preventivo.astro        ← il configuratore
    Footer.astro            ← testata di chiusura
  data/preventivo.ts        ← LE DOMANDE DEL FORM  ← si modifica qui
  scripts/preventivo.ts     ← passi, validazione, invio
  scripts/hero-comparison.ts ← trascinamento, tastiera e ritaglio della hero
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
| `consent`  | spunta di presa visione dell'informativa                          | `required`                           |

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

### Runbook per un agente sulla VPS

Questa parte è scritta per un assistente che opera **sulla macchina** dove gira
Coolify. Descrive l'obiettivo e i vincoli, non i comandi: gli strumenti che hai
a disposizione li conosci meglio tu, che sei sulla macchina.

**Dispiega prima il relay** (`form-relay`, altro repository, con un runbook suo
in `deploy/coolify.md`) e verificalo isolato: questo sito dipende da lui.

**Obiettivo.** Una risorsa Coolify che serve questo repository in HTTPS al
dominio del cliente. È fatta quando: la pagina risponde `200`, il certificato è
emesso, e il modulo di preventivo invia davvero — non quando il sito si vede.

**Vincoli.**

| | |
| --- | --- |
| Build pack | **Dockerfile**. Non Nixpacks: su questi progetti non funziona |
| Porta interna | **4321** |
| `PUBLIC_FORM_RELAY_URL` | l'origine del relay, es. `https://moduli.…` — **variabile di build** |
| `PUBLIC_FORM_RELAY_SITE` | l'id del sito nella config del relay, `vision-ark` — **variabile di build** |

**Il punto che si sbaglia sempre.** Astro incorpora le variabili `PUBLIC_*`
dentro il bundle JavaScript **durante la compilazione**. Non le legge a runtime.
Se le imposti come variabili runtime, la build riesce, il sito si vede, tutto
sembra a posto — e il modulo dice «invio non configurato». Devono essere
variabili di **build**.

Se mancano del tutto, la build stampa un avviso a tutta larghezza nei log: se lo
vedi passare, fermati e sistemale prima di andare avanti.

**Verifica, in quest'ordine.**

1. La home risponde `200`, `/privacy/` risponde `200`, e un URL inesistente
   risponde `404` — non `200` con la home, che sarebbe un errore di
   configurazione del server.
2. **L'endpoint è finito nel bundle.** È il controllo che smaschera la variabile
   messa come runtime: cerca l'host del relay dentro i file JavaScript serviti
   dal container, sotto `/_astro/`. Se non c'è, la build era cieca.
3. **Un invio vero dal browser**, non solo con curl: compila il modulo sul sito
   in produzione e controlla che la mail arrivi. È l'unica prova che tiene
   insieme sito, relay e provider di posta.

**Cosa non fare.**

- **Non far girare l'immagine con `docker run` a mano**: scavalcheresti proxy e
  certificato di Coolify, e la risorsa resterebbe fuori dalla sua gestione.
- **Non toccare i record DNS** senza chiedere. Il dominio del cliente è già in
  uso e serve posta: un A record spostato a sproposito manda giù il sito
  esistente, un CNAME sbagliato può rompere le caselle.
- **Non spostare il DNS prima** che Coolify abbia emesso il certificato: si
  resta con il sito giù nel frattempo. Prima la risorsa pronta, poi il DNS.
- **Non commentare la riga di avviso** nel Dockerfile per far tacere i log.

**Diagnosi dei fallimenti probabili.**

| sintomo | causa quasi certa |
| --- | --- |
| il modulo dice «invio non configurato» | le `PUBLIC_*` sono runtime invece che build |
| il modulo dà errore all'invio | il relay non risponde, o l'origine del sito non è fra le `origins` nella sua config |
| `404` su tutte le pagine tranne la home | la build non ha prodotto `dist/`, o nginx punta alla cartella sbagliata |
| certificato non emesso | il DNS del dominio non risolve ancora verso questa macchina |

---

## Cosa manca prima di pubblicare

L'anagrafica dello studio sta tutta in **`src/data/contatti.ts`** — nome, email,
telefono, P. IVA, sede. La leggono footer, `/privacy`, il `<noscript>` del form
e lo schema JSON-LD: se cambia un recapito si tocca solo quel file. Il dominio
sta in `astro.config.mjs` (`site`), da cui Astro deriva canonical e `og:url`.

Resta aperto:

- **`/privacy`** — confermare con il titolare che «Vision Ark» sia la ragione
  sociale corretta e che le richieste non sfociate in incarico vengano eliminate
  entro 12 mesi dall'ultimo contatto. Verificare anche i tempi dei log e le
  condizioni dei fornitori di hosting e posta prima della pubblicazione.
- **`form-relay`** — la voce `vision-ark` nel `config.json` sulla VPS, col
  destinatario vero e le origini di produzione.
- **`src/pages/index.astro`** — nello schema JSON-LD mancano `logo` e `image`:
  servono quando il marchio esiste come file. Vedi sotto.
- **Il marchio** — il logo della brochure (geometrico leggero, spaziatura
  stretta, filetto sopra «interior & more») e il wordmark del sito (Bricolage
  Grotesque 200, tracciato largo) sono due marchi diversi. Nel PDF il logo è
  rasterizzato dentro la foto: non se ne estrae un vettoriale. Se il cliente
  manda l'SVG si sostituisce in `Nav.astro` e `Footer.astro`; altrimenti resta
  quello attuale e va rifatta `public/favicon.svg`, che oggi non somiglia a
  nessuno dei due.

Contenuti da confermare con il cliente:

- L'elenco dei lavori sotto **Casa** in `Duality.astro` è dedotto: la brochure
  parla solo di strutture ricettive.
- Il modulo non indica un tempo di risposta: la precedente promessa di due
  giorni lavorativi è stata rimossa perché non confermata.
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

La hero sovrappone `04-lounge-drawing.png` a `04-lounge.png`. Su desktop il
separatore cancella anche il testo; sotto i 60rem il testo resta sopra il
confronto. Le immagini condividono dimensioni e ritaglio. Il controllo supporta
mouse, touch e tastiera (frecce, Home/Fine e Pagina su/giù), senza movimento
automatico. Senza JavaScript rimane visibile il confronto statico.

La pressione dei bottoni e il cambio di passo del form rispettano
`prefers-reduced-motion`.

Il sito non carica nessuna libreria di terze parti: zero dipendenze runtime,
solo i font autoospitati. Il JavaScript gestisce il confronto nella hero,
la galleria del portfolio e il modulo preventivo.
