/**
 * Anagrafica dello studio: un solo posto da toccare.
 * La leggono il footer, l'informativa privacy, il <noscript> del form e lo
 * schema JSON-LD della home. Se cambia un numero, cambia solo qui.
 */

export const contatti = {
  nome: "Vision Ark",
  email: "info@visionark.it",
  /** Formato leggibile: questo va a schermo. */
  telefono: "+39 379 349 1685",
  /** Senza spazi: questo va dentro href="tel:" e nel JSON-LD. */
  telefonoHref: "+393793491685",
  partitaIva: "10047541213",
  sede: {
    via: "Via Gennaro Paparo, 74",
    cap: "80040",
    comune: "Massa di Somma",
    provincia: "NA",
  },
} as const;

/** «80040 Massa di Somma (NA)» — la seconda riga dell'indirizzo. */
export const sedeLocalita = `${contatti.sede.cap} ${contatti.sede.comune} (${contatti.sede.provincia})`;

/** L'indirizzo su una riga sola, per i testi discorsivi. */
export const sedeEstesa = `${contatti.sede.via}, ${sedeLocalita}`;
