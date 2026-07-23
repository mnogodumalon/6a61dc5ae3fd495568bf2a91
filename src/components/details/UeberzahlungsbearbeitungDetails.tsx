import type { Ueberzahlungsbearbeitung, Forderungserfassung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface UeberzahlungsbearbeitungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Ueberzahlungsbearbeitung;
  /** N:1-Ziel „Forderungserfassung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  forderungserfassungList: Forderungserfassung[];
  /** Klick auf die Forderungserfassung-Relation → overlay.push auf dessen Detail. */
  onOpenForderungserfassung?: (record: Forderungserfassung) => void;
}

export function UeberzahlungsbearbeitungDetails({
  record,
  forderungserfassungList,
  onOpenForderungserfassung,
}: UeberzahlungsbearbeitungDetailsProps) {
  const forderungTarget = forderungserfassungList.find(r => r.record_id === extractRecordId(record.fields.forderung));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Überzahlter Betrag (€)" value={record.fields.ueberzahlter_betrag} format="text" />
        <RecordField label="Eingangsdatum der Zahlung" value={record.fields.eingangsdatum_zahlung} format="date" />
        <RecordField label="Maßnahme" value={record.fields.massnahme} format="pill" />
        <RecordField label="Bearbeitungsstatus" value={record.fields.bearbeitungsstatus} format="pill" />
        <RecordField label="Bearbeitungsdatum" value={record.fields.bearbeitungsdatum} format="date" />
        <RecordField label="Kontoinhaber Vorname" value={record.fields.kontoinhaber_vorname} format="text" />
        <RecordField label="Kontoinhaber Nachname" value={record.fields.kontoinhaber_nachname} format="text" />
        <RecordField label="IBAN" value={record.fields.iban} format="text" />
        <RecordField label="BIC" value={record.fields.bic} format="text" />
        <RecordField label="Kreditinstitut" value={record.fields.bank} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen} format="longtext" className="md:col-span-2" />
        <RecordField label="Nachweisdokument" className="md:col-span-2">
          {record.fields.dokument_nachweis ? (
            <MediaThumbnail src={record.fields.dokument_nachweis as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Forderung"
          name={forderungTarget?.fields.rechnungsnummer ?? '—'}
          meta={undefined}
          onClick={forderungTarget && onOpenForderungserfassung ? () => onOpenForderungserfassung!(forderungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.UEBERZAHLUNGSBEARBEITUNG} recordId={record.record_id} />
    </>
  );
}
