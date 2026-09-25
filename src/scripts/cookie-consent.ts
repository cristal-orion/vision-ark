/** Carica solo i servizi consentiti. GTM li avviava entrambi all'apertura della pagina. */
const STORAGE_KEY = "visionark-cookie-consent";
const VERSION = 1;
const GA_ID = "G-K6BLEM5E5W";
const META_ID = "1648496886937862";

type Choices = { analytics: boolean; marketing: boolean };
type StoredChoices = Choices & { version: number };
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};

const panel = document.querySelector<HTMLElement>("[data-cookie-panel]");
const analytics = panel?.querySelector<HTMLInputElement>("[data-cookie-analytics]");
const marketing = panel?.querySelector<HTMLInputElement>("[data-cookie-marketing]");

if (panel && analytics && marketing) {
  init(panel, analytics, marketing);
}

function init(panel: HTMLElement, analytics: HTMLInputElement, marketing: HTMLInputElement) {
  let saved = readChoices();
  let opener: HTMLElement | null = null;

  if (saved) {
    activate(saved);
  } else {
    // Elimina eventuali cookie lasciati dal vecchio GTM, prima del consenso.
    clearTrackingCookies({ analytics: true, marketing: true });
    panel.hidden = false;
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-cookie-settings]")) {
    button.addEventListener("click", () => {
      opener = button;
      analytics.checked = saved?.analytics ?? false;
      marketing.checked = saved?.marketing ?? false;
      panel.hidden = false;
      analytics.focus();
    });
  }

  panel.querySelector("[data-cookie-reject]")?.addEventListener("click", () => {
    save({ analytics: false, marketing: false });
  });
  panel.querySelector("[data-cookie-accept]")?.addEventListener("click", () => {
    save({ analytics: true, marketing: true });
  });
  panel.querySelector("[data-cookie-save]")?.addEventListener("click", () => {
    save({ analytics: analytics.checked, marketing: marketing.checked });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) window.location.reload();
  });

  function save(next: Choices) {
    const revoked = {
      analytics: saved?.analytics === true && !next.analytics,
      marketing: saved?.marketing === true && !next.marketing,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...next }));
    } catch {
      // Se lo storage è disabilitato, la scelta vale soltanto per questa pagina.
    }

    clearTrackingCookies(revoked);
    saved = { version: VERSION, ...next };
    panel.hidden = true;
    (opener ?? document.querySelector<HTMLElement>(".nav__wordmark"))?.focus();

    // Gli script già caricati non si possono "scaricare": ricaricare interrompe
    // le richieste future dei servizi revocati e applica solo le scelte rimaste.
    if (revoked.analytics || revoked.marketing) {
      window.location.reload();
      return;
    }
    activate(next);
  }
}

function readChoices(): StoredChoices | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      value && typeof value === "object" &&
      "version" in value && value.version === VERSION &&
      "analytics" in value && typeof value.analytics === "boolean" &&
      "marketing" in value && typeof value.marketing === "boolean"
    ) return value as StoredChoices;
  } catch {
    // Storage non disponibile o valore corrotto: non attivare nulla.
  }
  return null;
}

function activate(choices: Choices) {
  if (choices.analytics) loadAnalytics();
  if (choices.marketing) loadMarketing();
}

function loadAnalytics() {
  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = (...args: unknown[]) => { w.dataLayer?.push(args); };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID);
  addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
}

function loadMarketing() {
  const w = window as Window & { fbq?: Pixel; _fbq?: Pixel };
  if (w.fbq) return;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Pixel;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = w._fbq = fbq;
  fbq("init", META_ID);
  fbq("track", "PageView");
  addScript("https://connect.facebook.net/en_US/fbevents.js");
}

function addScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.append(script);
}

function clearTrackingCookies(revoked: Choices) {
  const domains = ["", ...(location.hostname === "visionark.it" || location.hostname.endsWith(".visionark.it") ? ["; domain=visionark.it"] : [])];
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (!name) continue;
    const ga = revoked.analytics && /^_ga(?:_|$)/.test(name);
    const meta = revoked.marketing && /^_fb[pc]$/.test(name);
    if (!ga && !meta) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; path=/; max-age=0${domain}`;
    }
  }
}
