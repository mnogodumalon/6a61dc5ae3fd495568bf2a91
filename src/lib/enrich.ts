import type { EnrichedForderungserfassung, EnrichedUeberzahlungsbearbeitung } from '@/types/enriched';
import type { Debitor, Forderungserfassung, Ueberzahlungsbearbeitung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface UeberzahlungsbearbeitungMaps {
  forderungserfassungMap: Map<string, Forderungserfassung>;
}

export function enrichUeberzahlungsbearbeitung(
  ueberzahlungsbearbeitung: Ueberzahlungsbearbeitung[],
  maps: UeberzahlungsbearbeitungMaps
): EnrichedUeberzahlungsbearbeitung[] {
  return ueberzahlungsbearbeitung.map(r => ({
    ...r,
    forderungName: resolveDisplay(r.fields.forderung, maps.forderungserfassungMap, 'rechnungsnummer'),
  }));
}

interface ForderungserfassungMaps {
  debitorMap: Map<string, Debitor>;
}

export function enrichForderungserfassung(
  forderungserfassung: Forderungserfassung[],
  maps: ForderungserfassungMaps
): EnrichedForderungserfassung[] {
  return forderungserfassung.map(r => ({
    ...r,
    schuldnerName: resolveDisplay(r.fields.schuldner, maps.debitorMap, 'kundennummer'),
  }));
}
