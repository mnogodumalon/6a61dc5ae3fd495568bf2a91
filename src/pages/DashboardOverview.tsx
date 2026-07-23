import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichForderungserfassung, enrichUeberzahlungsbearbeitung } from '@/lib/enrich';
import type { EnrichedForderungserfassung, EnrichedUeberzahlungsbearbeitung } from '@/types/enriched';
import type { Debitor as Schuldnerverwaltung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  RecordOverlay,
  RecordHeader,
  RecordKeyFacts,
  RecordSection,
  RecordField,
  RecordRelation,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ForderungserfassungDialog } from '@/components/dialogs/ForderungserfassungDialog';
import { SchuldnerverwaltungDialog } from '@/components/dialogs/SchuldnerverwaltungDialog';
import { UeberzahlungsbearbeitungDialog } from '@/components/dialogs/UeberzahlungsbearbeitungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconPlus,
  IconSearch,
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPencil,
  IconTrash,
  IconFilter,
  IconFileInvoice,
  IconUsers,
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconCurrencyEuro,
  IconArrowRight,
  IconX,
  IconChevronRight,
  IconReceiptOff,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a61dc5ae3fd495568bf2a91';
const REPAIR_ENDPOINT = '/claude/build/repair';

type StatusFilter = 'alle' | 'offen' | 'teilweise_bezahlt' | 'vollstaendig_bezahlt' | 'ueberzahlt';

function statusColor(key: string | undefined) {
  switch (key) {
    case 'offen': return 'bg-red-100 text-red-700 border-red-200';
    case 'teilweise_bezahlt': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'vollstaendig_bezahlt': return 'bg-green-100 text-green-700 border-green-200';
    case 'ueberzahlt': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function statusIcon(key: string | undefined) {
  switch (key) {
    case 'offen': return <IconAlertTriangle size={13} className="shrink-0" />;
    case 'teilweise_bezahlt': return <IconClock size={13} className="shrink-0" />;
    case 'vollstaendig_bezahlt': return <IconCircleCheck size={13} className="shrink-0" />;
    case 'ueberzahlt': return <IconCurrencyEuro size={13} className="shrink-0" />;
    default: return null;
  }
}

function bearbeitungsstatusColor(key: string | undefined) {
  switch (key) {
    case 'offen': return 'bg-orange-100 text-orange-700';
    case 'in_bearbeitung': return 'bg-blue-100 text-blue-700';
    case 'abgeschlossen': return 'bg-green-100 text-green-700';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function DashboardOverview() {
  const {
    debitor: schuldnerverwaltung, forderungserfassung, ueberzahlungsbearbeitung,
    debitorMap: schuldnerverwaltungMap, forderungserfassungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedForderungserfassung = enrichForderungserfassung(forderungserfassung, { debitorMap: schuldnerverwaltungMap });
  const enrichedUeberzahlungsbearbeitung = enrichUeberzahlungsbearbeitung(ueberzahlungsbearbeitung, { forderungserfassungMap });

  // All hooks before early returns
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');
  const [search, setSearch] = useState('');
  const [createForderungOpen, setCreateForderungOpen] = useState(false);
  const [editForderung, setEditForderung] = useState<EnrichedForderungserfassung | null>(null);
  const [deleteForderungTarget, setDeleteForderungTarget] = useState<EnrichedForderungserfassung | null>(null);
  const [createSchuldnerOpen, setCreateSchuldnerOpen] = useState(false);
  const [editSchuldner, setEditSchuldner] = useState<Schuldnerverwaltung | null>(null);
  const [createUeberzahlungOpen, setCreateUeberzahlungOpen] = useState(false);
  const [editUeberzahlung, setEditUeberzahlung] = useState<EnrichedUeberzahlungsbearbeitung | null>(null);
  const [deleteUeberzahlungTarget, setDeleteUeberzahlungTarget] = useState<EnrichedUeberzahlungsbearbeitung | null>(null);
  const [prefillForderungId, setPrefillForderungId] = useState<string | null>(null);

  const forderungOverlay = useRecordOverlayStack<EnrichedForderungserfassung>();
  const schuldnerOverlay = useRecordOverlayStack<Schuldnerverwaltung>();

  const filteredForderungen = useMemo(() => {
    return enrichedForderungserfassung.filter(f => {
      const statusKey = f.fields.zahlungsstatus?.key;
      if (statusFilter !== 'alle' && statusKey !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const schuldnerName = (f.fields.schuldner ? (() => {
          const id = extractRecordId(f.fields.schuldner);
          if (!id) return '';
          const s = schuldnerverwaltungMap.get(id);
          if (!s) return '';
          return `${s.fields.schuldner_vorname ?? ''} ${s.fields.schuldner_nachname ?? ''}`.toLowerCase();
        })() : '');
        return (
          (f.fields.rechnungsnummer ?? '').toLowerCase().includes(q) ||
          schuldnerName.includes(q) ||
          (f.fields.notizen_forderung ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enrichedForderungserfassung, statusFilter, search, schuldnerverwaltungMap]);

  const kpiStats = useMemo(() => {
    const offen = forderungserfassung.filter(f => f.fields.zahlungsstatus?.key === 'offen');
    const ueberzahlt = forderungserfassung.filter(f => f.fields.zahlungsstatus?.key === 'ueberzahlt');
    const totalOffen = offen.reduce((s, f) => s + ((f.fields.rechnungsbetrag ?? 0) - (f.fields.gezahlter_betrag ?? 0)), 0);
    const offeneUeber = ueberzahlungsbearbeitung.filter(u => u.fields.bearbeitungsstatus?.key === 'offen' || u.fields.bearbeitungsstatus?.key === 'in_bearbeitung');
    return {
      schuldnerCount: schuldnerverwaltung.length,
      forderungCount: forderungserfassung.length,
      offenBetrag: totalOffen,
      ueberzahltCount: ueberzahlt.length,
      offeneUeberzahlungen: offeneUeber.length,
    };
  }, [schuldnerverwaltung, forderungserfassung, ueberzahlungsbearbeitung]);

  const getSchuldnerForForderung = useCallback((f: EnrichedForderungserfassung): Schuldnerverwaltung | undefined => {
    const id = extractRecordId(f.fields.schuldner);
    if (!id) return undefined;
    return schuldnerverwaltungMap.get(id);
  }, [schuldnerverwaltungMap]);

  const getUeberzahlungenForForderung = useCallback((f: EnrichedForderungserfassung): EnrichedUeberzahlungsbearbeitung[] => {
    const forderungUrl = f.fields.schuldner ? createRecordUrl(APP_IDS.FORDERUNGSERFASSUNG, f.record_id) : null;
    return enrichedUeberzahlungsbearbeitung.filter(u => {
      const uForderungId = extractRecordId(u.fields.forderung);
      return uForderungId === f.record_id;
    });
  }, [enrichedUeberzahlungsbearbeitung]);

  const handleDeleteForderung = async () => {
    if (!deleteForderungTarget) return;
    await LivingAppsService.deleteForderungserfassungEntry(deleteForderungTarget.record_id);
    setDeleteForderungTarget(null);
    forderungOverlay.close();
    fetchAll();
  };

  const handleDeleteUeberzahlung = async () => {
    if (!deleteUeberzahlungTarget) return;
    await LivingAppsService.deleteUeberzahlungsbearbeitungEntry(deleteUeberzahlungTarget.record_id);
    setDeleteUeberzahlungTarget(null);
    fetchAll();
  };

  const handleCreateUeberzahlungForForderung = (f: EnrichedForderungserfassung) => {
    setPrefillForderungId(f.record_id);
    setCreateUeberzahlungOpen(true);
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const currentForderung = forderungOverlay.top;
  const currentSchuldner = schuldnerOverlay.top;

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'offen', label: 'Offen' },
    { key: 'teilweise_bezahlt', label: 'Teilweise bezahlt' },
    { key: 'vollstaendig_bezahlt', label: 'Vollständig bezahlt' },
    { key: 'ueberzahlt', label: 'Überzahlt' },
  ];

  return (
    <div className="space-y-6">
      {/* Workflow Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="#/intents/forderung-erfassen"
          className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconFileInvoice size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Forderung erfassen</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">Schuldner auswählen und neue Forderung anlegen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
        </a>
        <a
          href="#/intents/ueberzahlung-bearbeiten"
          className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconReceiptOff size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Überzahlung bearbeiten</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">Forderung auswählen und Überzahlung mit Rückerstattung erfassen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Schuldner"
          value={String(kpiStats.schuldnerCount)}
          description="Gesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Forderungen"
          value={String(kpiStats.forderungCount)}
          description="Gesamt"
          icon={<IconFileInvoice size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offener Betrag"
          value={kpiStats.offenBetrag > 999999
            ? `${(kpiStats.offenBetrag / 1000).toFixed(1)}k €`
            : formatCurrency(kpiStats.offenBetrag)}
          description="Noch ausstehend"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Überzahlungen"
          value={String(kpiStats.offeneUeberzahlungen)}
          description="In Bearbeitung"
          icon={<IconAlertCircle size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main workspace */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IconFilter size={16} className="shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    statusFilter === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="relative">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-48 text-sm"
                placeholder="Suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                  <IconX size={13} className="text-muted-foreground" />
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => setCreateSchuldnerOpen(true)} variant="outline">
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Schuldner</span>
            </Button>
            <Button size="sm" onClick={() => setCreateForderungOpen(true)}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Forderung</span>
            </Button>
          </div>
        </div>

        {/* Forderung list */}
        {filteredForderungen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <IconFileInvoice size={40} stroke={1.5} />
            <p className="text-sm">
              {search || statusFilter !== 'alle'
                ? 'Keine Forderungen gefunden'
                : 'Noch keine Forderungen erfasst'}
            </p>
            {!search && statusFilter === 'alle' && (
              <Button size="sm" onClick={() => setCreateForderungOpen(true)}>
                <IconPlus size={14} className="mr-1" /> Erste Forderung anlegen
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredForderungen.map(f => {
              const schuldner = getSchuldnerForForderung(f);
              const offenBetrag = (f.fields.rechnungsbetrag ?? 0) - (f.fields.gezahlter_betrag ?? 0);
              const statusKey = f.fields.zahlungsstatus?.key;
              const statusLabel = f.fields.zahlungsstatus?.label ?? '—';
              const ueberzahlungen = getUeberzahlungenForForderung(f);

              return (
                <div
                  key={f.record_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors group"
                  onClick={() => forderungOverlay.replace(f)}
                >
                  {/* Status indicator */}
                  <div className={`w-1.5 h-10 rounded-full shrink-0 ${
                    statusKey === 'offen' ? 'bg-red-400' :
                    statusKey === 'teilweise_bezahlt' ? 'bg-yellow-400' :
                    statusKey === 'vollstaendig_bezahlt' ? 'bg-green-400' :
                    statusKey === 'ueberzahlt' ? 'bg-purple-400' :
                    'bg-muted-foreground/30'
                  }`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">
                        {f.fields.rechnungsnummer ?? 'Ohne Nummer'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium border ${statusColor(statusKey)}`}>
                        {statusIcon(statusKey)}
                        {statusLabel}
                      </span>
                      {ueberzahlungen.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs bg-purple-100 text-purple-700 border border-purple-200">
                          <IconCurrencyEuro size={11} />
                          {ueberzahlungen.length} Überzahlung{ueberzahlungen.length > 1 ? 'en' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {schuldner && (
                        <span className="text-xs text-muted-foreground truncate">
                          {schuldner.fields.schuldner_vorname} {schuldner.fields.schuldner_nachname}
                          {schuldner.fields.unternehmen ? ` · ${schuldner.fields.unternehmen}` : ''}
                        </span>
                      )}
                      {f.fields.faelligkeitsdatum && (
                        <span className="text-xs text-muted-foreground">
                          Fällig: {formatDate(f.fields.faelligkeitsdatum)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(f.fields.rechnungsbetrag)}
                    </p>
                    {offenBetrag > 0 && statusKey !== 'vollstaendig_bezahlt' && (
                      <p className="text-xs text-muted-foreground">
                        Offen: {formatCurrency(offenBetrag)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                      onClick={e => { e.stopPropagation(); setEditForderung(f); }}
                      title="Bearbeiten"
                    >
                      <IconPencil size={14} />
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={e => { e.stopPropagation(); setDeleteForderungTarget(f); }}
                      title="Löschen"
                    >
                      <IconTrash size={14} />
                    </button>
                    <IconArrowRight size={14} className="text-muted-foreground/50 ml-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredForderungen.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {filteredForderungen.length} Forderung{filteredForderungen.length !== 1 ? 'en' : ''}
            {statusFilter !== 'alle' || search ? ` (gefiltert von ${forderungserfassung.length})` : ''}
          </div>
        )}
      </div>

      {/* Forderung Detail Overlay */}
      {currentForderung && (() => {
        const f = currentForderung;
        const schuldner = getSchuldnerForForderung(f);
        const ueberzahlungen = getUeberzahlungenForForderung(f);
        const offenBetrag = (f.fields.rechnungsbetrag ?? 0) - (f.fields.gezahlter_betrag ?? 0);
        const statusKey = f.fields.zahlungsstatus?.key;

        return (
          <RecordOverlay
            open={forderungOverlay.open}
            onClose={forderungOverlay.close}
            onEdit={() => setEditForderung(f)}
            placement="side"
            size="md"
          >
            <RecordHeader
              title={f.fields.rechnungsnummer ?? 'Ohne Nummer'}
              subtitle={schuldner
                ? `${schuldner.fields.schuldner_vorname ?? ''} ${schuldner.fields.schuldner_nachname ?? ''}`.trim() || schuldner.fields.unternehmen
                : undefined}
              badges={f.fields.zahlungsstatus ? [
                <span key="status" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(statusKey)}`}>
                  {statusIcon(statusKey)}
                  {f.fields.zahlungsstatus.label}
                </span>
              ] : undefined}
            />

            <RecordKeyFacts items={[
              { label: 'Rechnungsbetrag', value: formatCurrency(f.fields.rechnungsbetrag) },
              { label: 'Gezahlt', value: formatCurrency(f.fields.gezahlter_betrag) },
              { label: 'Offen', value: offenBetrag > 0 ? formatCurrency(offenBetrag) : '—' },
            ]} />

            <RecordSection title="Rechnungsdetails" cols={2}>
              <RecordField label="Rechnungsnummer" value={f.fields.rechnungsnummer} format="text" hideEmpty />
              <RecordField label="Rechnungsdatum" value={f.fields.rechnungsdatum} format="date" hideEmpty />
              <RecordField label="Fälligkeitsdatum" value={f.fields.faelligkeitsdatum} format="date" hideEmpty />
              <RecordField label="Zahlungsstatus" value={f.fields.zahlungsstatus?.label} format="pill" hideEmpty />
              {f.fields.notizen_forderung && (
                <RecordField label="Notizen" value={f.fields.notizen_forderung} format="longtext" className="md:col-span-2" hideEmpty />
              )}
            </RecordSection>

            {schuldner && (
              <RecordSection title="Schuldner">
                <RecordRelation
                  name={`${schuldner.fields.schuldner_vorname ?? ''} ${schuldner.fields.schuldner_nachname ?? ''}`.trim() || schuldner.fields.kundennummer || '—'}
                  meta={[
                    schuldner.fields.unternehmen,
                    schuldner.fields.email,
                    schuldner.fields.telefon,
                  ].filter(Boolean).join(' · ')}
                  icon={IconUsers}
                  onClick={() => schuldnerOverlay.replace(schuldner)}
                />
              </RecordSection>
            )}

            {ueberzahlungen.length > 0 && (
              <RecordSection title="Überzahlungen">
                {ueberzahlungen.map(u => (
                  <div key={u.record_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatCurrency(u.fields.ueberzahlter_betrag)}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {u.fields.massnahme && (
                          <span className="text-xs text-muted-foreground">{u.fields.massnahme.label}</span>
                        )}
                        {u.fields.bearbeitungsstatus && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${bearbeitungsstatusColor(u.fields.bearbeitungsstatus.key)}`}>
                            {u.fields.bearbeitungsstatus.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                        onClick={() => setEditUeberzahlung(u)}
                      >
                        <IconPencil size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteUeberzahlungTarget(u)}
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => handleCreateUeberzahlungForForderung(f)}
                >
                  <IconPlus size={14} className="mr-1" /> Überzahlung erfassen
                </Button>
              </RecordSection>
            )}

            {ueberzahlungen.length === 0 && statusKey === 'ueberzahlt' && (
              <RecordSection title="Überzahlungen">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCreateUeberzahlungForForderung(f)}
                >
                  <IconPlus size={14} className="mr-1" /> Überzahlung erfassen
                </Button>
              </RecordSection>
            )}

            <RecordAttachments appId={APP_IDS.FORDERUNGSERFASSUNG} recordId={f.record_id} />
          </RecordOverlay>
        );
      })()}

      {/* Schuldner Detail Overlay */}
      {currentSchuldner && (
        <RecordOverlay
          open={schuldnerOverlay.open}
          onClose={schuldnerOverlay.close}
          onEdit={() => setEditSchuldner(currentSchuldner)}
          placement="side"
          size="sm"
        >
          <RecordHeader
            title={`${currentSchuldner.fields.schuldner_vorname ?? ''} ${currentSchuldner.fields.schuldner_nachname ?? ''}`.trim() || currentSchuldner.fields.kundennummer || 'Schuldner'}
            subtitle={currentSchuldner.fields.unternehmen}
          />
          <RecordSection title="Kontakt" cols={2}>
            <RecordField label="Kundennummer" value={currentSchuldner.fields.kundennummer} format="text" hideEmpty />
            <RecordField label="E-Mail" value={currentSchuldner.fields.email} format="email" hideEmpty />
            <RecordField label="Telefon" value={currentSchuldner.fields.telefon} format="text" hideEmpty />
            <RecordField label="Letzter Vorgang" value={currentSchuldner.fields.letzter_vorgang} format="date" hideEmpty />
          </RecordSection>
          <RecordSection title="Adresse" cols={2}>
            <RecordField label="Straße / Nr." value={[currentSchuldner.fields.strasse, currentSchuldner.fields.hausnummer].filter(Boolean).join(' ')} format="text" hideEmpty />
            <RecordField label="PLZ / Ort" value={[currentSchuldner.fields.postleitzahl, currentSchuldner.fields.ort].filter(Boolean).join(' ')} format="text" hideEmpty />
          </RecordSection>
          {currentSchuldner.fields.notizen_schuldner && (
            <RecordSection>
              <RecordField label="Notizen" value={currentSchuldner.fields.notizen_schuldner} format="longtext" hideEmpty />
            </RecordSection>
          )}
          <RecordAttachments appId={APP_IDS.DEBITOR} recordId={currentSchuldner.record_id} />
        </RecordOverlay>
      )}

      {/* Dialogs */}
      <ForderungserfassungDialog
        open={createForderungOpen}
        onClose={() => setCreateForderungOpen(false)}
        onSubmit={async (fields) => {
          await LivingAppsService.createForderungserfassungEntry(fields);
          fetchAll();
        }}
        debitorList={schuldnerverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Forderungserfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Forderungserfassung']}
      />

      <ForderungserfassungDialog
        open={!!editForderung}
        onClose={() => setEditForderung(null)}
        onSubmit={async (fields) => {
          if (!editForderung) return;
          await LivingAppsService.updateForderungserfassungEntry(editForderung.record_id, fields);
          fetchAll();
        }}
        defaultValues={editForderung?.fields}
        recordId={editForderung?.record_id}
        debitorList={schuldnerverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Forderungserfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Forderungserfassung']}
      />

      <SchuldnerverwaltungDialog
        open={createSchuldnerOpen}
        onClose={() => setCreateSchuldnerOpen(false)}
        onSubmit={async (fields) => {
          await LivingAppsService.createDebitorEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Schuldnerverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Schuldnerverwaltung']}
      />

      <SchuldnerverwaltungDialog
        open={!!editSchuldner}
        onClose={() => setEditSchuldner(null)}
        onSubmit={async (fields) => {
          if (!editSchuldner) return;
          await LivingAppsService.updateDebitorEntry(editSchuldner.record_id, fields);
          fetchAll();
        }}
        defaultValues={editSchuldner?.fields}
        recordId={editSchuldner?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Schuldnerverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Schuldnerverwaltung']}
      />

      <UeberzahlungsbearbeitungDialog
        open={createUeberzahlungOpen}
        onClose={() => {
          setCreateUeberzahlungOpen(false);
          setPrefillForderungId(null);
        }}
        onSubmit={async (fields) => {
          await LivingAppsService.createUeberzahlungsbearbeitungEntry(fields);
          setPrefillForderungId(null);
          fetchAll();
        }}
        defaultValues={prefillForderungId ? {
          forderung: createRecordUrl(APP_IDS.FORDERUNGSERFASSUNG, prefillForderungId),
        } : undefined}
        forderungserfassungList={forderungserfassung}
        enablePhotoScan={AI_PHOTO_SCAN['Ueberzahlungsbearbeitung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Ueberzahlungsbearbeitung']}
      />

      <UeberzahlungsbearbeitungDialog
        open={!!editUeberzahlung}
        onClose={() => setEditUeberzahlung(null)}
        onSubmit={async (fields) => {
          if (!editUeberzahlung) return;
          await LivingAppsService.updateUeberzahlungsbearbeitungEntry(editUeberzahlung.record_id, fields);
          fetchAll();
        }}
        defaultValues={editUeberzahlung?.fields}
        recordId={editUeberzahlung?.record_id}
        forderungserfassungList={forderungserfassung}
        enablePhotoScan={AI_PHOTO_SCAN['Ueberzahlungsbearbeitung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Ueberzahlungsbearbeitung']}
      />

      <ConfirmDialog
        open={!!deleteForderungTarget}
        title="Forderung löschen"
        description={`Forderung "${deleteForderungTarget?.fields.rechnungsnummer ?? ''}" wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDeleteForderung}
        onClose={() => setDeleteForderungTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteUeberzahlungTarget}
        title="Überzahlung löschen"
        description="Diese Überzahlung wirklich löschen?"
        onConfirm={handleDeleteUeberzahlung}
        onClose={() => setDeleteUeberzahlungTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-1.5 h-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
