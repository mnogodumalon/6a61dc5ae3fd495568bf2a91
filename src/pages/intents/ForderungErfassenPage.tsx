import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Debitor as Schuldnerverwaltung, Forderungserfassung } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconUser,
  IconCheck,
  IconPlus,
  IconArrowLeft,
  IconFileInvoice,
  IconAlertCircle,
  IconCircleCheck,
  IconExternalLink,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Schuldner' },
  { label: 'Forderung' },
  { label: 'Zusammenfassung' },
];

const ZAHLUNGSSTATUS_OPTIONS = LOOKUP_OPTIONS['forderungserfassung']?.['zahlungsstatus'] ?? [];

function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

interface ForderungFormState {
  rechnungsnummer: string;
  rechnungsdatum: string;
  faelligkeitsdatum: string;
  rechnungsbetrag: string;
  gezahlter_betrag: string;
  zahlungsstatus: string;
  notizen_forderung: string;
}

const EMPTY_FORM: ForderungFormState = {
  rechnungsnummer: '',
  rechnungsdatum: '',
  faelligkeitsdatum: '',
  rechnungsbetrag: '',
  gezahlter_betrag: '0',
  zahlungsstatus: ZAHLUNGSSTATUS_OPTIONS[0]?.key ?? 'offen',
  notizen_forderung: '',
};

function getSchuldnerName(s: Schuldnerverwaltung): string {
  const { schuldner_vorname, schuldner_nachname, unternehmen } = s.fields;
  if (unternehmen) return unternehmen;
  const parts = [schuldner_vorname, schuldner_nachname].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '(Kein Name)';
}

function SchuldnerInfoCard({ schuldner }: { schuldner: Schuldnerverwaltung }) {
  const name = getSchuldnerName(schuldner);
  const { kundennummer, ort } = schuldner.fields;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-secondary/30 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <IconUser size={20} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[kundennummer ? `Nr. ${kundennummer}` : null, ort].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}

function OffenerBetragCard({
  rechnungsbetrag,
  gezahlter_betrag,
}: {
  rechnungsbetrag: number;
  gezahlter_betrag: number;
}) {
  const offenerBetrag = rechnungsbetrag - gezahlter_betrag;
  let colorClass = 'bg-green-50 border-green-200 text-green-700';
  let label = 'Vollständig bezahlt';
  if (offenerBetrag > 0 && offenerBetrag < rechnungsbetrag) {
    colorClass = 'bg-orange-50 border-orange-200 text-orange-700';
    label = 'Teilweise offen';
  } else if (offenerBetrag >= rechnungsbetrag && rechnungsbetrag > 0) {
    colorClass = 'bg-red-50 border-red-200 text-red-700';
    label = 'Vollständig offen';
  } else if (offenerBetrag < 0) {
    colorClass = 'bg-amber-50 border-amber-200 text-amber-700';
    label = 'Überzahlt';
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">Offener Betrag</p>
      <p className="text-2xl font-bold">{formatEuro(offenerBetrag)}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );
}

export default function ForderungErfassenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { debitor: schuldnerverwaltung, loading, error, fetchAll } = useDashboardData();

  // Initialize step from URL
  const urlStep = parseInt(searchParams.get('step') ?? '1', 10);
  const validStep = urlStep >= 1 && urlStep <= 3 ? urlStep : 1;
  const [step, setStep] = useState(validStep);

  const urlSchuldnerId = searchParams.get('schuldnerId') ?? '';
  const [selectedSchuldnerId, setSelectedSchuldnerId] = useState<string>(urlSchuldnerId);
  const [form, setForm] = useState<ForderungFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdForderung, setCreatedForderung] = useState<Forderungserfassung | null>(null);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('step', String(step));
    if (selectedSchuldnerId) {
      params.set('schuldnerId', selectedSchuldnerId);
    } else {
      params.delete('schuldnerId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedSchuldnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSchuldner = schuldnerverwaltung.find(s => s.record_id === selectedSchuldnerId) ?? null;

  function handleStepChange(newStep: number) {
    // Only allow going back, not forward past completed steps
    if (newStep < step) setStep(newStep);
  }

  function handleSelectSchuldner(id: string) {
    setSelectedSchuldnerId(id);
    setStep(2);
  }

  function handleFormChange(field: keyof ForderungFormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmitForderung() {
    if (!selectedSchuldner) return;

    setSubmitError(null);

    const rechnungsbetrag = parseFloat(form.rechnungsbetrag.replace(',', '.'));
    const gezahlter_betrag = parseFloat(form.gezahlter_betrag.replace(',', '.') || '0');

    if (!form.rechnungsnummer.trim()) {
      setSubmitError('Bitte gib eine Rechnungsnummer ein.');
      return;
    }
    if (isNaN(rechnungsbetrag) || rechnungsbetrag <= 0) {
      setSubmitError('Bitte gib einen gültigen Rechnungsbetrag ein.');
      return;
    }
    if (!form.rechnungsdatum) {
      setSubmitError('Bitte wähle ein Rechnungsdatum.');
      return;
    }
    if (!form.faelligkeitsdatum) {
      setSubmitError('Bitte wähle ein Fälligkeitsdatum.');
      return;
    }

    setSubmitting(true);
    try {
      const schuldnerUrl = createRecordUrl(APP_IDS.DEBITOR, selectedSchuldner.record_id);

      const fields = {
        rechnungsnummer: form.rechnungsnummer.trim(),
        rechnungsdatum: form.rechnungsdatum,
        faelligkeitsdatum: form.faelligkeitsdatum,
        rechnungsbetrag,
        gezahlter_betrag: isNaN(gezahlter_betrag) ? 0 : gezahlter_betrag,
        zahlungsstatus: form.zahlungsstatus,
        schuldner: schuldnerUrl,
        ...(form.notizen_forderung.trim() ? { notizen_forderung: form.notizen_forderung.trim() } : {}),
      };

      await LivingAppsService.createForderungserfassungEntry(fields);
      await fetchAll();

      // Build a local representation for the summary
      const forderung: Forderungserfassung = {
        record_id: '',
        createdat: new Date().toISOString(),
        updatedat: null,
        fields: {
          rechnungsnummer: form.rechnungsnummer.trim(),
          rechnungsdatum: form.rechnungsdatum,
          faelligkeitsdatum: form.faelligkeitsdatum,
          rechnungsbetrag,
          gezahlter_betrag: isNaN(gezahlter_betrag) ? 0 : gezahlter_betrag,
          zahlungsstatus: ZAHLUNGSSTATUS_OPTIONS.find(o => o.key === form.zahlungsstatus),
          schuldner: schuldnerUrl,
          notizen_forderung: form.notizen_forderung.trim() || undefined,
        },
      };
      setCreatedForderung(forderung);
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleWeitereForderung() {
    setForm(EMPTY_FORM);
    setCreatedForderung(null);
    setSubmitError(null);
    setStep(2);
  }

  function handleNeuenSchuldner() {
    setForm(EMPTY_FORM);
    setCreatedForderung(null);
    setSubmitError(null);
    setSelectedSchuldnerId('');
    setStep(1);
  }

  const rechnungsbetragNum = parseFloat(form.rechnungsbetrag.replace(',', '.')) || 0;
  const gezahlterBetragNum = parseFloat(form.gezahlter_betrag.replace(',', '.')) || 0;

  return (
    <IntentWizardShell
      title="Forderung erfassen"
      subtitle="Registriere eine neue Forderung für einen Schuldner"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Schuldner auswählen */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Schuldner auswählen</h2>
            <p className="text-sm text-muted-foreground">
              Wähle den Schuldner aus, für den du eine Forderung erfassen möchtest.
            </p>
          </div>

          <EntitySelectStep
            items={schuldnerverwaltung.map(s => {
              const name = getSchuldnerName(s);
              const { kundennummer, ort } = s.fields;
              const subtitleParts = [
                kundennummer ? `Nr. ${kundennummer}` : null,
                ort,
              ].filter(Boolean);
              return {
                id: s.record_id,
                title: name,
                subtitle: subtitleParts.join(' · '),
                icon: <IconUser size={20} className="text-primary" />,
              };
            })}
            onSelect={handleSelectSchuldner}
            searchPlaceholder="Schuldner suchen..."
            emptyIcon={<IconUser size={32} />}
            emptyText="Keine Schuldner gefunden."
            createLabel="Neuen Schuldner anlegen"
            onCreateNew={() => {
              window.open('#/schuldnerverwaltung', '_blank');
            }}
          />

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Wenn du einen neuen Schuldner anlegst, öffnet sich die Schuldnerverwaltung in einem neuen Tab.
              Komm danach zurück und wähle ihn hier aus.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Forderung erfassen */}
      {step === 2 && selectedSchuldner && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Forderung erfassen</h2>
            <p className="text-sm text-muted-foreground">
              Trage die Details der Forderung ein.
            </p>
          </div>

          <SchuldnerInfoCard schuldner={selectedSchuldner} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Rechnungsnummer */}
            <div className="space-y-2">
              <Label htmlFor="rechnungsnummer">Rechnungsnummer *</Label>
              <Input
                id="rechnungsnummer"
                placeholder="z. B. RE-2026-001"
                value={form.rechnungsnummer}
                onChange={e => handleFormChange('rechnungsnummer', e.target.value)}
              />
            </div>

            {/* Zahlungsstatus */}
            <div className="space-y-2">
              <Label htmlFor="zahlungsstatus">Zahlungsstatus</Label>
              <select
                id="zahlungsstatus"
                value={form.zahlungsstatus}
                onChange={e => handleFormChange('zahlungsstatus', e.target.value)}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {ZAHLUNGSSTATUS_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Rechnungsdatum */}
            <div className="space-y-2">
              <Label htmlFor="rechnungsdatum">Rechnungsdatum *</Label>
              <Input
                id="rechnungsdatum"
                type="date"
                value={form.rechnungsdatum}
                onChange={e => handleFormChange('rechnungsdatum', e.target.value)}
              />
            </div>

            {/* Fälligkeitsdatum */}
            <div className="space-y-2">
              <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum *</Label>
              <Input
                id="faelligkeitsdatum"
                type="date"
                value={form.faelligkeitsdatum}
                onChange={e => handleFormChange('faelligkeitsdatum', e.target.value)}
              />
            </div>

            {/* Rechnungsbetrag */}
            <div className="space-y-2">
              <Label htmlFor="rechnungsbetrag">Rechnungsbetrag (€) *</Label>
              <div className="relative">
                <Input
                  id="rechnungsbetrag"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.rechnungsbetrag}
                  onChange={e => handleFormChange('rechnungsbetrag', e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">€</span>
              </div>
            </div>

            {/* Gezahlter Betrag */}
            <div className="space-y-2">
              <Label htmlFor="gezahlter_betrag">Bereits gezahlter Betrag (€)</Label>
              <div className="relative">
                <Input
                  id="gezahlter_betrag"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.gezahlter_betrag}
                  onChange={e => handleFormChange('gezahlter_betrag', e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">€</span>
              </div>
            </div>
          </div>

          {/* Live Offener Betrag Card */}
          {rechnungsbetragNum > 0 && (
            <OffenerBetragCard
              rechnungsbetrag={rechnungsbetragNum}
              gezahlter_betrag={gezahlterBetragNum}
            />
          )}

          {/* Notizen */}
          <div className="space-y-2">
            <Label htmlFor="notizen_forderung">Notizen (optional)</Label>
            <textarea
              id="notizen_forderung"
              rows={3}
              placeholder="Weitere Hinweise zur Forderung..."
              value={form.notizen_forderung}
              onChange={e => handleFormChange('notizen_forderung', e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          {/* Error */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <IconAlertCircle size={16} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleSubmitForderung}
              disabled={submitting}
              className="gap-2 flex-1 sm:flex-none"
            >
              {submitting ? (
                <>Speichern...</>
              ) : (
                <>
                  <IconFileInvoice size={16} />
                  Forderung speichern
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Zusammenfassung */}
      {step === 3 && createdForderung && selectedSchuldner && (
        <div className="space-y-6">
          {/* Success header */}
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
              <IconCircleCheck size={28} className="text-green-600" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Forderung erfasst!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Die Forderung wurde erfolgreich gespeichert.
              </p>
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-secondary/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zusammenfassung</p>
            </div>
            <div className="divide-y">
              {/* Schuldner */}
              <div className="px-5 py-3 flex items-center gap-3">
                <IconUser size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Schuldner</p>
                  <p className="text-sm font-medium truncate">{getSchuldnerName(selectedSchuldner)}</p>
                </div>
                {selectedSchuldner.fields.kundennummer && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    Nr. {selectedSchuldner.fields.kundennummer}
                  </span>
                )}
              </div>

              {/* Rechnungsnummer */}
              <div className="px-5 py-3 flex items-center gap-3">
                <IconFileInvoice size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Rechnungsnummer</p>
                  <p className="text-sm font-medium">{createdForderung.fields.rechnungsnummer}</p>
                </div>
                {createdForderung.fields.zahlungsstatus && (
                  <StatusBadge
                    statusKey={createdForderung.fields.zahlungsstatus.key}
                    label={createdForderung.fields.zahlungsstatus.label}
                  />
                )}
              </div>

              {/* Daten */}
              <div className="px-5 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Rechnungsdatum</p>
                  <p className="text-sm font-medium">{createdForderung.fields.rechnungsdatum ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fälligkeitsdatum</p>
                  <p className="text-sm font-medium">{createdForderung.fields.faelligkeitsdatum ?? '—'}</p>
                </div>
              </div>

              {/* Beträge */}
              <div className="px-5 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Rechnungsbetrag</p>
                  <p className="text-sm font-semibold">{formatEuro(createdForderung.fields.rechnungsbetrag ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gezahlter Betrag</p>
                  <p className="text-sm font-semibold">{formatEuro(createdForderung.fields.gezahlter_betrag ?? 0)}</p>
                </div>
              </div>

              {/* Offener Betrag */}
              <div className="px-5 py-3">
                <p className="text-xs text-muted-foreground mb-1">Offener Betrag</p>
                <p className="text-lg font-bold text-foreground">
                  {formatEuro((createdForderung.fields.rechnungsbetrag ?? 0) - (createdForderung.fields.gezahlter_betrag ?? 0))}
                </p>
              </div>

              {/* Notizen */}
              {createdForderung.fields.notizen_forderung && (
                <div className="px-5 py-3">
                  <p className="text-xs text-muted-foreground">Notizen</p>
                  <p className="text-sm mt-0.5">{createdForderung.fields.notizen_forderung}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleWeitereForderung}
              className="gap-2 w-full"
            >
              <IconPlus size={16} />
              Weitere Forderung für diesen Schuldner
            </Button>

            <Button
              variant="outline"
              onClick={handleNeuenSchuldner}
              className="gap-2 w-full"
            >
              <IconUser size={16} />
              Anderen Schuldner wählen
            </Button>

            <div className="flex items-center justify-center pt-2">
              <a
                href="#/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <IconCheck size={14} />
                Zurück zum Dashboard
              </a>
            </div>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
