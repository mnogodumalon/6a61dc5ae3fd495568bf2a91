// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Ueberzahlungsbearbeitung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    forderung?: string; // applookup -> URL zu 'Forderungserfassung' Record
    ueberzahlter_betrag?: number;
    eingangsdatum_zahlung?: string; // Format: YYYY-MM-DD oder ISO String
    massnahme?: LookupValue;
    bearbeitungsstatus?: LookupValue;
    bearbeitungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    kontoinhaber_vorname?: string;
    kontoinhaber_nachname?: string;
    iban?: string;
    bic?: string;
    bank?: string;
    bemerkungen?: string;
    dokument_nachweis?: string;
  };
}

export interface Forderungserfassung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnungsnummer?: string;
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    rechnungsbetrag?: number;
    gezahlter_betrag?: number;
    zahlungsstatus?: LookupValue;
    schuldner?: string; // applookup -> URL zu 'Debitor' Record
    notizen_forderung?: string;
    dokument_rechnung?: string;
  };
}

export interface Debitor {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kundennummer?: string;
    schuldner_vorname?: string;
    schuldner_nachname?: string;
    unternehmen?: string;
    letzter_vorgang?: string; // Format: YYYY-MM-DD oder ISO String
    strasse?: string;
    hausnummer?: string;
    postleitzahl?: string;
    ort?: string;
    email?: string;
    telefon?: string;
    notizen_schuldner?: string;
  };
}

export const APP_IDS = {
  UEBERZAHLUNGSBEARBEITUNG: '6a61dc5ba21f30738c093acf',
  FORDERUNGSERFASSUNG: '6a61dc5ba2d980b0b5e2eba6',
  DEBITOR: '6a61dc5ba6b5f055c1d1f5f9',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'ueberzahlungsbearbeitung': {
    massnahme: [{ key: "rueckerstattung", label: "Rückerstattung" }, { key: "verrechnung", label: "Verrechnung mit anderer Forderung" }, { key: "gutschrift", label: "Gutschrift" }, { key: "sonstiges", label: "Sonstiges" }],
    bearbeitungsstatus: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }],
  },
  'forderungserfassung': {
    zahlungsstatus: [{ key: "offen", label: "Offen" }, { key: "teilweise_bezahlt", label: "Teilweise bezahlt" }, { key: "vollstaendig_bezahlt", label: "Vollständig bezahlt" }, { key: "ueberzahlt", label: "Überzahlt" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'ueberzahlungsbearbeitung': {
    'forderung': 'applookup/select',
    'ueberzahlter_betrag': 'number',
    'eingangsdatum_zahlung': 'date/date',
    'massnahme': 'lookup/select',
    'bearbeitungsstatus': 'lookup/select',
    'bearbeitungsdatum': 'date/date',
    'kontoinhaber_vorname': 'string/text',
    'kontoinhaber_nachname': 'string/text',
    'iban': 'string/text',
    'bic': 'string/text',
    'bank': 'string/text',
    'bemerkungen': 'string/textarea',
    'dokument_nachweis': 'file',
  },
  'forderungserfassung': {
    'rechnungsnummer': 'string/text',
    'rechnungsdatum': 'date/date',
    'faelligkeitsdatum': 'date/date',
    'rechnungsbetrag': 'number',
    'gezahlter_betrag': 'number',
    'zahlungsstatus': 'lookup/select',
    'schuldner': 'applookup/select',
    'notizen_forderung': 'string/textarea',
    'dokument_rechnung': 'file',
  },
  'debitor': {
    'kundennummer': 'string/text',
    'schuldner_vorname': 'string/text',
    'schuldner_nachname': 'string/text',
    'unternehmen': 'string/text',
    'letzter_vorgang': 'date/date',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'postleitzahl': 'string/text',
    'ort': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'notizen_schuldner': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateUeberzahlungsbearbeitung = StripLookup<Ueberzahlungsbearbeitung['fields']>;
export type CreateForderungserfassung = StripLookup<Forderungserfassung['fields']>;
export type CreateDebitor = StripLookup<Debitor['fields']>;