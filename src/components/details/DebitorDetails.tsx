import type { Debitor, Forderungserfassung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface DebitorDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Debitor;
  /** 1:N „Forderungserfassung": VOLLE Liste — der Block filtert auf diesen Record. */
  forderungserfassungList: Forderungserfassung[];
  /** Zeilen-Klick → overlay.push auf das Forderungserfassung-Detail (nie der Edit-Dialog). */
  onOpenForderungserfassung: (record: Forderungserfassung) => void;
  /** Kontextuelles „+": öffnet den Forderungserfassung-Dialog mit diesem Record vorgesetzt. */
  onAddForderungserfassung: () => void;
}

export function DebitorDetails({
  record,
  forderungserfassungList,
  onOpenForderungserfassung,
  onAddForderungserfassung,
}: DebitorDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Kundennummer" value={record.fields.kundennummer} format="text" />
        <RecordField label="Vorname" value={record.fields.schuldner_vorname} format="text" />
        <RecordField label="Nachname" value={record.fields.schuldner_nachname} format="text" />
        <RecordField label="Unternehmen" value={record.fields.unternehmen} format="text" />
        <RecordField label="Letzter Vorgang" value={record.fields.letzter_vorgang} format="date" />
        <RecordField label="Straße" value={record.fields.strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.postleitzahl} format="text" />
        <RecordField label="Ort" value={record.fields.ort} format="text" />
        <RecordField label="E-Mail-Adresse" value={record.fields.email} format="email" />
        <RecordField label="Telefonnummer" value={record.fields.telefon} format="text" />
        <RecordField label="Notizen" value={record.fields.notizen_schuldner} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Forderungserfassung"
        items={forderungserfassungList.filter(r => extractRecordId(r.fields.schuldner) === record.record_id)}
        map={r => ({ name: r.fields.rechnungsnummer ?? 'Forderungserfassung', meta: r.fields.rechnungsdatum })}
        onOpen={onOpenForderungserfassung}
        onAdd={onAddForderungserfassung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.DEBITOR} recordId={record.record_id} />
    </>
  );
}
