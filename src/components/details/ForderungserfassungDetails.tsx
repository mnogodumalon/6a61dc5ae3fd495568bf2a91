import type { Forderungserfassung, Debitor, Ueberzahlungsbearbeitung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ForderungserfassungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Forderungserfassung;
  /** N:1-Ziel „Debitor": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  debitorList: Debitor[];
  /** Klick auf die Debitor-Relation → overlay.push auf dessen Detail. */
  onOpenDebitor?: (record: Debitor) => void;
  /** 1:N „Überzahlungsbearbeitung": VOLLE Liste — der Block filtert auf diesen Record. */
  ueberzahlungsbearbeitungList: Ueberzahlungsbearbeitung[];
  /** Zeilen-Klick → overlay.push auf das Ueberzahlungsbearbeitung-Detail (nie der Edit-Dialog). */
  onOpenUeberzahlungsbearbeitung: (record: Ueberzahlungsbearbeitung) => void;
  /** Kontextuelles „+": öffnet den Ueberzahlungsbearbeitung-Dialog mit diesem Record vorgesetzt. */
  onAddUeberzahlungsbearbeitung: () => void;
}

export function ForderungserfassungDetails({
  record,
  debitorList,
  onOpenDebitor,
  ueberzahlungsbearbeitungList,
  onOpenUeberzahlungsbearbeitung,
  onAddUeberzahlungsbearbeitung,
}: ForderungserfassungDetailsProps) {
  const schuldnerTarget = debitorList.find(r => r.record_id === extractRecordId(record.fields.schuldner));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Rechnungsnummer" value={record.fields.rechnungsnummer} format="text" />
        <RecordField label="Rechnungsdatum" value={record.fields.rechnungsdatum} format="date" />
        <RecordField label="Fälligkeitsdatum" value={record.fields.faelligkeitsdatum} format="date" />
        <RecordField label="Rechnungsbetrag (€)" value={record.fields.rechnungsbetrag} format="text" />
        <RecordField label="Bereits gezahlter Betrag (€)" value={record.fields.gezahlter_betrag} format="text" />
        <RecordField label="Zahlungsstatus" value={record.fields.zahlungsstatus} format="pill" />
        <RecordField label="Notizen zur Forderung" value={record.fields.notizen_forderung} format="longtext" className="md:col-span-2" />
        <RecordField label="Rechnungsdokument" className="md:col-span-2">
          {record.fields.dokument_rechnung ? (
            <MediaThumbnail src={record.fields.dokument_rechnung as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Schuldner"
          name={schuldnerTarget?.fields.kundennummer ?? '—'}
          meta={[schuldnerTarget?.fields.email, schuldnerTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={schuldnerTarget && onOpenDebitor ? () => onOpenDebitor!(schuldnerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Überzahlungsbearbeitung"
        items={ueberzahlungsbearbeitungList.filter(r => extractRecordId(r.fields.forderung) === record.record_id)}
        map={r => ({ name: r.fields.kontoinhaber_vorname ?? 'Überzahlungsbearbeitung', meta: r.fields.eingangsdatum_zahlung })}
        onOpen={onOpenUeberzahlungsbearbeitung}
        onAdd={onAddUeberzahlungsbearbeitung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.FORDERUNGSERFASSUNG} recordId={record.record_id} />
    </>
  );
}
