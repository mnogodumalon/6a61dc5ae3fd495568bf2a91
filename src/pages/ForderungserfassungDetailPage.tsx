import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Forderungserfassung, Debitor } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { ForderungserfassungDialog } from '@/components/dialogs/ForderungserfassungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Forderungserfassung';
import { evalComputed } from '@/config/form-enhancements/types';

export default function ForderungserfassungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Forderungserfassung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [debitorList, setDebitorList] = useState<Debitor[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, debitorData] = await Promise.all([
        LivingAppsService.getForderungserfassung(),
        LivingAppsService.getDebitor(),
      ]);
      setDebitorList(debitorData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Forderungserfassung['fields']) {
    if (!record) return;
    await LivingAppsService.updateForderungserfassungEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteForderungserfassungEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/forderungserfassung');
  }

  function getDebitorDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return debitorList.find(r => r.record_id === refId)?.fields.kundennummer ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/forderungserfassung')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/forderungserfassung')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.rechnungsnummer ?? 'Forderungserfassung'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          schuldner: debitorList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Rechnungsnummer" value={record.fields.rechnungsnummer} format="text" />
        <RecordField label="Rechnungsdatum" value={record.fields.rechnungsdatum} format="date" />
        <RecordField label="Fälligkeitsdatum" value={record.fields.faelligkeitsdatum} format="date" />
        <RecordField label="Rechnungsbetrag (€)" value={record.fields.rechnungsbetrag} format="text" />
        <RecordField label="Bereits gezahlter Betrag (€)" value={record.fields.gezahlter_betrag} format="text" />
        <RecordField label="Zahlungsstatus" value={record.fields.zahlungsstatus} format="pill" />
        <RecordField label="Schuldner" value={getDebitorDisplayName(record.fields.schuldner)} format="text" />
        <RecordField label="Notizen zur Forderung" value={record.fields.notizen_forderung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.FORDERUNGSERFASSUNG} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <ForderungserfassungDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        debitorList={debitorList}
        enablePhotoScan={AI_PHOTO_SCAN['Forderungserfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Forderungserfassung']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Forderungserfassung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
