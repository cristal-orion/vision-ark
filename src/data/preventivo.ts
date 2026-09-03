/**
 * Configurazione del configuratore di preventivo.
 *
 * Aggiungere una domanda = aggiungere un oggetto a `steps`.
 * Il markup, la navigazione, la validazione e il corpo della mail
 * si adattano da sé: nessun componente da toccare.
 */

export type ChoiceOption = {
  value: string;
  label: string;
  /** riga di dettaglio sotto l'etichetta, dentro la card selezionabile */
  note?: string;
};

/**
 * `label` è quello che legge chi compila. `shortLabel`, quando c'è, è quello
 * che legge chi riceve la notifica: serve per i campi la cui etichetta visibile
 * è una frase intera — un consenso privacy per esteso, in una mail, diventa
 * una riga illeggibile.
 */
export type Field =
  | {
      kind: "choice";
      name: string;
      /** etichetta usata nella mail e come legend del fieldset */
      label: string;
      shortLabel?: string;
      options: ChoiceOption[];
      /** true = checkbox (più risposte), false/assente = radio (una sola) */
      multiple?: boolean;
      required?: boolean;
      hint?: string;
    }
  | {
      kind: "text" | "email" | "tel";
      name: string;
      label: string;
      shortLabel?: string;
      required?: boolean;
      placeholder?: string;
      autocomplete?: string;
      /** larghezza nella griglia dei contatti: 1 = metà riga, 2 = riga intera */
      span?: 1 | 2;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      shortLabel?: string;
      required?: boolean;
      placeholder?: string;
      rows?: number;
    }
  | {
      kind: "consent";
      name: string;
      label: string;
      shortLabel?: string;
      required?: boolean;
    };

export type Step = {
  id: string;
  /** etichetta breve per l'indicatore di avanzamento */
  tag: string;
  /** la domanda, grande, in cima allo step */
  question: string;
  note?: string;
  fields: Field[];
};

export const steps: Step[] = [
  {
    id: "immobile",
    tag: "L'immobile",
    question: "Casa o attività?",
    note: "Serve a capire con chi parliamo: un appartamento e una struttura ricettiva hanno vincoli, tempi e autorizzazioni diversi.",
    fields: [
      {
        kind: "choice",
        name: "tipo_immobile",
        label: "Tipo di immobile",
        required: true,
        options: [
          {
            value: "Casa",
            label: "Casa",
            note: "Appartamento, villa, casa indipendente. Ristrutturazione totale o singoli ambienti.",
          },
          {
            value: "Attività",
            label: "Attività",
            note: "Hotel, B&B, ristorante, negozio, ufficio. Anche a struttura aperta, per fasi.",
          },
        ],
      },
    ],
  },
  {
    id: "ambienti",
    tag: "Gli ambienti",
    question: "Interni, esterni o tutti e due?",
    note: "Puoi selezionare più di una voce.",
    fields: [
      {
        kind: "choice",
        name: "ambienti",
        label: "Ambienti",
        required: true,
        multiple: true,
        options: [
          {
            value: "Interni",
            label: "Interni",
            note: "Ingressi, camere, bagni, cucine, aree comuni, zone relax.",
          },
          {
            value: "Esterni",
            label: "Esterni",
            note: "Facciate, ingressi, terrazze, rooftop, lounge outdoor, percorsi e illuminazione.",
          },
        ],
      },
    ],
  },
  {
    id: "contatti",
    tag: "I contatti",
    question: "Dove ti richiamiamo?",
    note: "Rispondiamo entro due giorni lavorativi con le domande tecniche che servono a fare un numero serio.",
    fields: [
      {
        kind: "text",
        name: "nome",
        label: "Nome e cognome",
        required: true,
        autocomplete: "name",
        placeholder: "Nome e cognome",
        span: 2,
      },
      {
        kind: "email",
        name: "email",
        label: "Email",
        required: true,
        autocomplete: "email",
        placeholder: "nome@dominio.it",
        span: 1,
      },
      {
        kind: "tel",
        name: "telefono",
        label: "Telefono",
        required: true,
        autocomplete: "tel",
        placeholder: "+39",
        span: 1,
      },
      {
        kind: "text",
        name: "indirizzo",
        label: "Indirizzo dell'immobile",
        required: true,
        autocomplete: "street-address",
        placeholder: "Via, civico, città",
        span: 2,
      },
      {
        kind: "textarea",
        name: "note",
        label: "Raccontaci il progetto",
        placeholder:
          "Metri quadri, stato attuale, cosa vorresti ottenere, tempi che hai in testa.",
        rows: 4,
      },
      {
        kind: "consent",
        name: "privacy",
        label:
          "Ho letto l'informativa privacy e acconsento al trattamento dei dati per essere ricontattato.",
        shortLabel: "Consenso privacy",
        required: true,
      },
    ],
  },
];

/**
 * Etichette per la mail di notifica, indicizzate per nome.
 * Usa `shortLabel` quando c'è: nella mail conta la scansione rapida.
 */
export const fieldLabels: Record<string, string> = Object.fromEntries(
  steps.flatMap((step) =>
    step.fields.map((field) => [field.name, field.shortLabel ?? field.label]),
  ),
);
