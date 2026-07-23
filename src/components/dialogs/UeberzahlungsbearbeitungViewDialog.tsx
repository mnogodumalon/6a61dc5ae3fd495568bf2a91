import type { Ueberzahlungsbearbeitung, Forderungserfassung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface UeberzahlungsbearbeitungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Ueberzahlungsbearbeitung | null;
  onEdit: (record: Ueberzahlungsbearbeitung) => void;
  forderungserfassungList: Forderungserfassung[];
}

export function UeberzahlungsbearbeitungViewDialog({ open, onClose, record, onEdit, forderungserfassungList }: UeberzahlungsbearbeitungViewDialogProps) {
  function getForderungserfassungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return forderungserfassungList.find(r => r.record_id === id)?.fields.rechnungsnummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Überzahlungsbearbeitung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Forderung</Label>
            <p className="text-sm">{getForderungserfassungDisplayName(record.fields.forderung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Überzahlter Betrag (€)</Label>
            <p className="text-sm">{record.fields.ueberzahlter_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Eingangsdatum der Zahlung</Label>
            <p className="text-sm">{formatDate(record.fields.eingangsdatum_zahlung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Maßnahme</Label>
            <Badge variant="secondary">{record.fields.massnahme?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bearbeitungsstatus</Label>
            <Badge variant="secondary">{record.fields.bearbeitungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bearbeitungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.bearbeitungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontoinhaber Vorname</Label>
            <p className="text-sm">{record.fields.kontoinhaber_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontoinhaber Nachname</Label>
            <p className="text-sm">{record.fields.kontoinhaber_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">IBAN</Label>
            <p className="text-sm">{record.fields.iban ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">BIC</Label>
            <p className="text-sm">{record.fields.bic ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kreditinstitut</Label>
            <p className="text-sm">{record.fields.bank ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachweisdokument</Label>
            {record.fields.dokument_nachweis ? (
              <MediaThumbnail src={record.fields.dokument_nachweis} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.UEBERZAHLUNGSBEARBEITUNG} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}