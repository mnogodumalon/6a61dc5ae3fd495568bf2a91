import type { Forderungserfassung, Ueberzahlungsbearbeitung } from './app';

export type EnrichedUeberzahlungsbearbeitung = Ueberzahlungsbearbeitung & {
  forderungName: string;
};

export type EnrichedForderungserfassung = Forderungserfassung & {
  schuldnerName: string;
};
