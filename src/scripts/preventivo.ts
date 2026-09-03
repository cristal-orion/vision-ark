/**
 * Configuratore di preventivo — navigazione a passi, validazione e invio.
 *
 * Il markup è già in pagina (renderizzato da Astro dal file di configurazione):
 * questo modulo lo trasforma in un form a passi. Senza JS il form resta
 * interamente visibile e il <noscript> offre i contatti diretti.
 */

import { fieldLabels, steps } from "../data/preventivo";

/**
 * Lo spread è voluto: Vite sostituisce `import.meta.env.X` col valore letterale
 * a build time, quindi senza `.env` la guardia sulla configurazione diventerebbe
 * staticamente vera e Rollup butterebbe via come dead code tutto il ramo di
 * invio. Passando da un oggetto mutabile la lettura resta runtime e il codice
 * sopravvive alla build anche a variabili mancanti.
 */
const env: Record<string, string | undefined> = { ...import.meta.env };

/**
 * L'invio passa da form-relay, il servizio condiviso sulla VPS: qui non c'è
 * nessuna chiave, solo l'indirizzo dell'endpoint e l'id del sito. La chiave
 * del provider di posta sta sul server, dove il pubblico non la vede.
 */
const RELAY_URL = env.PUBLIC_FORM_RELAY_URL;
const RELAY_SITE = env.PUBLIC_FORM_RELAY_SITE;

/** Momento in cui la pagina è stata caricata: il relay scarta gli invii istantanei. */
const LOADED_AT = Date.now();

const form = document.querySelector<HTMLFormElement>("#quote");
if (form) init(form);

function init(form: HTMLFormElement) {
  const panels = [...form.querySelectorAll<HTMLElement>("[data-quote-step]")];
  const ticks = [...form.querySelectorAll<HTMLElement>("[data-quote-tick]")];
  const counter = form.querySelector<HTMLElement>("[data-quote-current]");
  const live = form.querySelector<HTMLElement>("[data-quote-live]");
  const prevBtn = form.querySelector<HTMLButtonElement>("[data-quote-prev]");
  const nextBtn = form.querySelector<HTMLButtonElement>("[data-quote-next]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[data-quote-submit]");
  const submitLabel = form.querySelector<HTMLElement>("[data-quote-submit-label]");
  const fail = form.querySelector<HTMLElement>("[data-quote-fail]");
  const done = document.querySelector<HTMLElement>("[data-quote-done]");

  if (!panels.length || !nextBtn || !submitBtn) return;

  /* Alias non-nullable. Le `function` dichiarate sotto sono hoisted, quindi
     TypeScript non propaga la guardia qui sopra al loro interno. */
  const nextEl = nextBtn;
  const submitEl = submitBtn;

  let index = 0;
  let sending = false;

  show(0, { focus: false });

  nextBtn.addEventListener("click", () => {
    if (!validate(index)) return;
    show(Math.min(index + 1, panels.length - 1));
  });

  prevBtn?.addEventListener("click", () => {
    clearErrors(panels[index]);
    show(Math.max(index - 1, 0));
  });

  // Invio sull'ultimo passo; Enter nei campi avanza invece di inviare.
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    if (index < panels.length - 1) nextBtn.click();
    else form.requestSubmit();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void send();
  });

  // La validazione si ripulisce appena l'utente corregge.
  form.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    const holder = target.closest<HTMLElement>("[data-field]");
    if (holder?.hasAttribute("data-invalid")) clearField(holder);
  });

  form.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    const holder = target.closest<HTMLElement>("[data-field]");
    if (holder?.hasAttribute("data-invalid")) clearField(holder);
  });

  /* ── Navigazione ─────────────────────────────────────────────────────── */

  function show(next: number, options: { focus?: boolean } = {}) {
    index = next;

    panels.forEach((panel, i) => {
      const active = i === index;
      panel.hidden = !active;
      panel.toggleAttribute("data-quote-active", active);
    });

    ticks.forEach((tick, i) => {
      if (i === index) tick.setAttribute("aria-current", "step");
      else tick.removeAttribute("aria-current");
      tick.toggleAttribute("data-done", i < index);
    });

    if (counter) counter.textContent = String(index + 1).padStart(2, "0");

    const last = index === panels.length - 1;
    if (prevBtn) prevBtn.hidden = index === 0;
    nextEl.hidden = last;
    submitEl.hidden = !last;

    if (fail) fail.hidden = true;

    const step = steps[index];
    if (live && step) {
      live.textContent = `Passo ${index + 1} di ${panels.length}: ${step.tag}.`;
    }

    if (options.focus !== false) {
      /* Il focus va sul primo controllo, non sul titolo: chi usa la tastiera
         trova un bersaglio vero e chi usa il mouse non si becca un anello
         intorno a un'intestazione. Il cambio di passo lo annuncia la live
         region qui sopra. */
      const first = panels[index]?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select',
      );
      first?.focus({ preventScroll: true });
      panels[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  /* ── Validazione ─────────────────────────────────────────────────────── */

  function validate(stepIndex: number) {
    const panel = panels[stepIndex];
    if (!panel) return true;

    clearErrors(panel);
    let firstBad: HTMLElement | null = null;

    for (const holder of panel.querySelectorAll<HTMLElement>("[data-field]")) {
      if (holder.dataset.required !== "true") continue;

      const name = holder.dataset.field ?? "";
      const inputs = [
        ...holder.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
      ];
      const message = check(inputs, name);
      if (!message) continue;

      holder.setAttribute("data-invalid", "");
      const slot = panel.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
      // Lo slot resta sempre in pagina (region aria-live persistente e
      // altezza riservata via CSS): si riempie e si svuota, non si nasconde.
      if (slot) slot.textContent = message;
      inputs[0]?.setAttribute("aria-invalid", "true");
      firstBad ??= (inputs[0] as HTMLElement | undefined) ?? holder;
    }

    if (firstBad) {
      const focusTarget = firstBad.classList.contains("visually-hidden")
        ? firstBad.closest<HTMLElement>(".card")
        : firstBad;
      (focusTarget ?? firstBad).scrollIntoView({ block: "center", behavior: "smooth" });
      firstBad.focus({ preventScroll: true });
      return false;
    }

    return true;
  }

  function check(
    inputs: (HTMLInputElement | HTMLTextAreaElement)[],
    name: string,
  ): string | null {
    const first = inputs[0];
    if (!first) return null;

    if (first instanceof HTMLInputElement && (first.type === "radio" || first.type === "checkbox")) {
      const picked = inputs.some((i) => (i as HTMLInputElement).checked);
      if (picked) return null;
      if (name === "privacy") return "Serve il consenso per poterti ricontattare.";
      return inputs.length > 2 || first.type === "checkbox"
        ? "Seleziona almeno una voce."
        : "Seleziona una voce.";
    }

    const value = first.value.trim();
    if (!value) return "Campo obbligatorio.";

    if (first instanceof HTMLInputElement && first.type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Controlla l’indirizzo email.";
    }

    if (first instanceof HTMLInputElement && first.type === "tel") {
      const digits = value.replace(/[^\d]/g, "");
      if (digits.length < 8) return "Serve un numero raggiungibile.";
    }

    return null;
  }

  function clearErrors(panel: HTMLElement | undefined) {
    if (!panel) return;
    for (const holder of panel.querySelectorAll<HTMLElement>("[data-field][data-invalid]")) {
      clearField(holder);
    }
  }

  function clearField(holder: HTMLElement) {
    holder.removeAttribute("data-invalid");
    const name = holder.dataset.field ?? "";
    const slot = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (slot) slot.textContent = "";
    holder
      .querySelectorAll<HTMLElement>("[aria-invalid]")
      .forEach((el) => el.removeAttribute("aria-invalid"));
  }

  /* ── Invio ───────────────────────────────────────────────────────────── */

  async function send() {
    if (sending) return;

    // Ricontrolla tutti i passi, non solo l'ultimo.
    for (let i = 0; i < panels.length; i += 1) {
      if (!validate(i)) {
        show(i);
        return;
      }
    }

    if (!RELAY_URL || !RELAY_SITE) {
      setState("error", "Invio non configurato");
      showFail(
        "PUBLIC_FORM_RELAY_URL o PUBLIC_FORM_RELAY_SITE non sono impostate. Copia .env.example in .env.",
      );
      return;
    }

    sending = true;
    setState("loading", "Invio in corso…");
    if (fail) fail.hidden = true;

    try {
      const response = await fetch(`${RELAY_URL.replace(/\/$/, "")}/s/${RELAY_SITE}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collect()),
        // 20s: il relay ha un suo timeout più corto verso il provider
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.message || `il server ha risposto ${response.status}`);
      }

      setState("success", "Inviata");
      form.hidden = true;
      if (done) {
        done.hidden = false;
        const title = done.querySelector<HTMLElement>(".done__title");
        title?.setAttribute("tabindex", "-1");
        title?.focus({ preventScroll: true });
        done.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    } catch (error) {
      setState("error", "Riprova");
      showFail(
        "Non siamo riusciti a inviare la richiesta. Riprova, oppure scrivici a info@visionark.it.",
      );
      console.error("[preventivo] invio non riuscito", error);
    } finally {
      sending = false;
    }
  }

  function setState(state: "loading" | "error" | "success" | null, label?: string) {
    if (state) submitEl.dataset.state = state;
    else delete submitEl.dataset.state;
    submitEl.disabled = state === "loading" || state === "success";
    if (label && submitLabel) submitLabel.textContent = label;
  }

  function showFail(message: string) {
    if (!fail) return;
    fail.textContent = message;
    fail.hidden = false;
  }

  /**
   * Compone il corpo per form-relay.
   *
   * `labels` e `order` viaggiano insieme ai valori: è il motivo per cui il
   * relay resta generico e non deve sapere niente di questo modulo. Se domani
   * aggiungi una domanda in src/data/preventivo.ts, la mail si adegua da sé.
   */
  function collect() {
    const data = new FormData(form);
    const fields: Record<string, string> = {};
    const labels: Record<string, string> = {};
    const order: string[] = [];

    for (const step of steps) {
      for (const field of step.fields) {
        const values = data.getAll(field.name).map(String).filter(Boolean);
        fields[field.name] =
          field.kind === "consent" ? (values.length ? "Sì" : "No") : values.join(", ");
        labels[field.name] = fieldLabels[field.name] ?? field.name;
        order.push(field.name);
      }
    }

    // Campi tecnici: honeypot vuoto e istante di caricamento della pagina.
    // Il relay li usa per riconoscere i bot e non li mette nella mail.
    fields._hp = "";
    fields._ts = String(LOADED_AT);

    return {
      fields,
      labels,
      order,
      meta: { page: location.href },
    };
  }
}
