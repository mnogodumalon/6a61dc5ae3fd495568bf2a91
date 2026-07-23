import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichForderungserfassung } from '@/lib/enrich';
import type { EnrichedForderungserfassung } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  IconFileInvoice,
  IconChevronRight,
  IconArrowLeft,
  IconCheck,
  IconCurrencyEuro,
  IconCalendar,
  IconAlertTriangle,
  IconCircleCheck,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Forderung' },
  { label: 'Überzahlung' },
  { label: 'Kontodaten' },
  { label: 'Abschluss' },
];

const MASSNAHME_OPTIONS = LOOKUP_OPTIONS['ueberzahlungsbearbeitung']['massnahme'];
const BEARBEITUNGSSTATUS_OPTIONS = LOOKUP_OPTIONS['ueberzahlungsbearbeitung']['bearbeitungsstatus'];

function formatEuro(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function UeberzahlungBearbeitenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { forderungserfassung, debitorMap: schuldnerverwaltungMap, loading, error, fetchAll } = useDashboardData();

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedForderung, setSelectedForderung] = useState<EnrichedForderungserfassung | null>(null);

  // Step 2 form state
  const [ueberzahlterBetrag, setUeberzahlterBetrag] = useState('');
  const [eingangsdatumZahlung, setEingangsdatumZahlung] = useState('');
  const [massnahme, setMassnahme] = useState('');
  const [bearbeitungsstatus, setBearbeitungsstatus] = useState('');
  const [bemerkungen, setBemerkungen] = useState('');

  // Step 3 form state
  const [kontohaberVorname, setKontoinhaberVorname] = useState('');
  const [kontohaberNachname, setKontoinhaberNachname] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [bank, setBank] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);

  // Step 2 validation errors
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
  // Step 3 validation errors
  const [step3Errors, setStep3Errors] = useState<Record<string, string>>({});

  // Deep-link: read forderungId and step from URL on mount
  useEffect(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    if (urlStep >= 1 && urlStep <= 4) {
      setStep(urlStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step + forderungId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedForderung) {
      params.set('forderungId', selectedForderung.record_id);
    } else {
      params.delete('forderungId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedForderung, searchParams, setSearchParams]);

  // Enrich forderungen
  const enrichedForderungen = useMemo(() =>
    enrichForderungserfassung(forderungserfassung, { debitorMap: schuldnerverwaltungMap }),
    [forderungserfassung, schuldnerverwaltungMap]
  );

  // After load, if forderungId in URL, auto-select the forderung
  useEffect(() => {
    if (!loading && enrichedForderungen.length > 0) {
      const urlForderungId = searchParams.get('forderungId');
      if (urlForderungId && !selectedForderung) {
        const found = enrichedForderungen.find(f => f.record_id === urlForderungId);
        if (found) setSelectedForderung(found);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, enrichedForderungen]);

  // Computed difference
  const rechnungsbetrag = selectedForderung?.fields.rechnungsbetrag ?? 0;
  const gezahlterBetrag = selectedForderung?.fields.gezahlter_betrag ?? 0;
  const differenz = gezahlterBetrag - rechnungsbetrag;

  const isRueckerstattung = massnahme === 'rueckerstattung';

  function handleForderungSelect(id: string) {
    const f = enrichedForderungen.find(x => x.record_id === id);
    if (f) {
      setSelectedForderung(f);
      setStep(2);
    }
  }

  function validateStep2(): boolean {
    const errors: Record<string, string> = {};
    if (!ueberzahlterBetrag || isNaN(parseFloat(ueberzahlterBetrag))) {
      errors.ueberzahlterBetrag = 'Bitte gib einen gültigen Betrag ein.';
    }
    if (!eingangsdatumZahlung) {
      errors.eingangsdatumZahlung = 'Bitte wähle ein Eingangsdatum aus.';
    }
    if (!massnahme) {
      errors.massnahme = 'Bitte wähle eine Maßnahme aus.';
    }
    if (!bearbeitungsstatus) {
      errors.bearbeitungsstatus = 'Bitte wähle einen Bearbeitungsstatus aus.';
    }
    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep3(): boolean {
    const errors: Record<string, string> = {};
    if (isRueckerstattung) {
      if (!kontohaberVorname.trim()) errors.kontohaberVorname = 'Bitte gib den Vornamen des Kontoinhabers an.';
      if (!kontohaberNachname.trim()) errors.kontohaberNachname = 'Bitte gib den Nachnamen des Kontoinhabers an.';
      if (!iban.trim()) errors.iban = 'Bitte gib eine IBAN an.';
      if (!bic.trim()) errors.bic = 'Bitte gib eine BIC an.';
      if (!bank.trim()) errors.bank = 'Bitte gib den Banknamen an.';
    }
    setStep3Errors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateStep3()) return;
    if (!selectedForderung) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await LivingAppsService.createUeberzahlungsbearbeitungEntry({
        forderung: createRecordUrl(APP_IDS.FORDERUNGSERFASSUNG, selectedForderung.record_id),
        ueberzahlter_betrag: parseFloat(ueberzahlterBetrag),
        eingangsdatum_zahlung: eingangsdatumZahlung,
        massnahme: massnahme,
        bearbeitungsstatus: bearbeitungsstatus,
        bearbeitungsdatum: today,
        kontoinhaber_vorname: kontohaberVorname.trim() || undefined,
        kontoinhaber_nachname: kontohaberNachname.trim() || undefined,
        iban: iban.trim().toUpperCase() || undefined,
        bic: bic.trim().toUpperCase() || undefined,
        bank: bank.trim() || undefined,
        bemerkungen: bemerkungen.trim() || undefined,
      });
      // Extract record id from result
      const entries = Object.entries(result as Record<string, unknown>);
      const recordId = entries.length > 0 ? (entries[0][0] as string) : null;
      setCreatedRecordId(recordId);
      await fetchAll();
      setStep(4);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Speichern der Überzahlung.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSelectedForderung(null);
    setUeberzahlterBetrag('');
    setEingangsdatumZahlung('');
    setMassnahme('');
    setBearbeitungsstatus('');
    setBemerkungen('');
    setKontoinhaberVorname('');
    setKontoinhaberNachname('');
    setIban('');
    setBic('');
    setBank('');
    setSubmitError(null);
    setCreatedRecordId(null);
    setStep2Errors({});
    setStep3Errors({});
    setStep(1);
  }

  const massnahmeLabel = MASSNAHME_OPTIONS.find(o => o.key === massnahme)?.label ?? massnahme;
  const bearbeitungsstatusLabel = BEARBEITUNGSSTATUS_OPTIONS.find(o => o.key === bearbeitungsstatus)?.label ?? bearbeitungsstatus;

  return (
    <IntentWizardShell
      title="Überzahlung bearbeiten"
      subtitle="Erfasse und verarbeite eine Überzahlung auf eine Forderung"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ---- STEP 1: Forderung auswählen ---- */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border p-5">
            <h2 className="text-base font-semibold mb-1">Forderung auswählen</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Wähle die Forderung aus, für die eine Überzahlung eingegangen ist.
            </p>
            <EntitySelectStep
              searchPlaceholder="Rechnungsnummer oder Schuldner suchen..."
              emptyIcon={<IconFileInvoice size={32} />}
              emptyText="Keine Forderungen gefunden."
              items={enrichedForderungen.map(f => ({
                id: f.record_id,
                title: f.fields.rechnungsnummer ?? `Forderung ${f.record_id.slice(0, 8)}`,
                subtitle: [
                  f.schuldnerName ? `Schuldner: ${f.schuldnerName}` : null,
                  f.fields.rechnungsbetrag !== undefined ? formatEuro(f.fields.rechnungsbetrag) : null,
                ].filter(Boolean).join(' · '),
                status: f.fields.zahlungsstatus
                  ? { key: f.fields.zahlungsstatus.key, label: f.fields.zahlungsstatus.label }
                  : undefined,
                stats: [
                  { label: 'Rechnungsbetrag', value: formatEuro(f.fields.rechnungsbetrag) },
                  { label: 'Gezahlt', value: formatEuro(f.fields.gezahlter_betrag) },
                ],
                icon: <IconFileInvoice size={20} className="text-primary" />,
              }))}
              onSelect={handleForderungSelect}
            />
          </div>
        </div>
      )}

      {/* ---- STEP 2: Überzahlung erfassen ---- */}
      {step === 2 && selectedForderung && (
        <div className="space-y-4">
          {/* Forderung Info Card */}
          <div className="bg-card rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Ausgewählte Forderung</p>
                <h2 className="text-base font-semibold">
                  {selectedForderung.fields.rechnungsnummer ?? `Forderung ${selectedForderung.record_id.slice(0, 8)}`}
                </h2>
                {selectedForderung.schuldnerName && (
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedForderung.schuldnerName}</p>
                )}
              </div>
              {selectedForderung.fields.zahlungsstatus && (
                <StatusBadge
                  statusKey={selectedForderung.fields.zahlungsstatus.key}
                  label={selectedForderung.fields.zahlungsstatus.label}
                />
              )}
            </div>
          </div>

          {/* Live Calculation Card */}
          <div className="bg-secondary rounded-2xl border p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <IconCurrencyEuro size={16} className="text-primary" />
              Zahlungsübersicht
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-card rounded-xl p-3 border">
                <p className="text-xs text-muted-foreground mb-0.5">Rechnungsbetrag</p>
                <p className="text-lg font-bold">{formatEuro(rechnungsbetrag)}</p>
              </div>
              <div className="bg-card rounded-xl p-3 border">
                <p className="text-xs text-muted-foreground mb-0.5">Gezahlter Betrag</p>
                <p className="text-lg font-bold">{formatEuro(gezahlterBetrag)}</p>
              </div>
              <div className={`rounded-xl p-3 border ${differenz > 0 ? 'bg-green-50 border-green-200' : differenz < 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
                <p className="text-xs text-muted-foreground mb-0.5">Differenz</p>
                <p className={`text-lg font-bold ${differenz > 0 ? 'text-green-700' : differenz < 0 ? 'text-red-700' : ''}`}>
                  {differenz > 0 ? '+' : ''}{formatEuro(differenz)}
                </p>
                {differenz > 0 && <p className="text-xs text-green-600 mt-0.5">Überzahlung</p>}
                {differenz < 0 && <p className="text-xs text-red-600 mt-0.5">Noch ausstehend</p>}
              </div>
            </div>
          </div>

          {/* Überzahlungs-Formular */}
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <h3 className="text-base font-semibold">Überzahlung erfassen</h3>

            {/* Überzahlter Betrag */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="ueberzahlter-betrag">
                Überzahlter Betrag (€) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <IconCurrencyEuro size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ueberzahlter-betrag"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={ueberzahlterBetrag}
                  onChange={e => setUeberzahlterBetrag(e.target.value)}
                  className="pl-9"
                />
              </div>
              {step2Errors.ueberzahlterBetrag && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {step2Errors.ueberzahlterBetrag}
                </p>
              )}
            </div>

            {/* Eingangsdatum */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="eingangsdatum">
                Eingangsdatum der Zahlung <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="eingangsdatum"
                  type="date"
                  value={eingangsdatumZahlung}
                  onChange={e => setEingangsdatumZahlung(e.target.value)}
                  className="pl-9"
                />
              </div>
              {step2Errors.eingangsdatumZahlung && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {step2Errors.eingangsdatumZahlung}
                </p>
              )}
            </div>

            {/* Maßnahme */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Maßnahme <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MASSNAHME_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMassnahme(opt.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      massnahme === opt.key
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-secondary border-border hover:bg-accent'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      massnahme === opt.key ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {massnahme === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              {step2Errors.massnahme && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {step2Errors.massnahme}
                </p>
              )}
            </div>

            {/* Bearbeitungsstatus */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Bearbeitungsstatus <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {BEARBEITUNGSSTATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBearbeitungsstatus(opt.key)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      bearbeitungsstatus === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary border-border hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {step2Errors.bearbeitungsstatus && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {step2Errors.bearbeitungsstatus}
                </p>
              )}
            </div>

            {/* Bemerkungen */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="bemerkungen">
                Bemerkungen <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <textarea
                id="bemerkungen"
                rows={3}
                placeholder="Optionale Hinweise zur Überzahlung..."
                value={bemerkungen}
                onChange={e => setBemerkungen(e.target.value)}
                className="w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex items-center gap-2">
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button onClick={() => { if (validateStep2()) setStep(3); }} className="flex items-center gap-2">
              Weiter zu Kontodaten
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ---- STEP 3: Kontodaten für Rückerstattung ---- */}
      {step === 3 && selectedForderung && (
        <div className="space-y-4">
          {/* Step 2 Summary */}
          <div className="bg-secondary rounded-2xl border p-5">
            <h3 className="text-sm font-semibold mb-3">Zusammenfassung Überzahlung</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Forderung</p>
                <p className="font-medium truncate">
                  {selectedForderung.fields.rechnungsnummer ?? selectedForderung.record_id.slice(0, 8)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Überzahlter Betrag</p>
                <p className="font-medium">{formatEuro(parseFloat(ueberzahlterBetrag) || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maßnahme</p>
                <p className="font-medium">{massnahmeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{bearbeitungsstatusLabel}</p>
              </div>
            </div>
          </div>

          {/* Kontodaten Formular */}
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold">
                Kontodaten für Rückerstattung
                {!isRueckerstattung && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </h3>
              {isRueckerstattung ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Da die Maßnahme "Rückerstattung" gewählt wurde, sind Kontodaten erforderlich.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Kontodaten können optional hinterlegt werden.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kontoinhaber Vorname */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="kontoinhaber-vorname">
                  Vorname des Kontoinhabers
                  {isRueckerstattung && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  id="kontoinhaber-vorname"
                  type="text"
                  placeholder="Vorname"
                  value={kontohaberVorname}
                  onChange={e => setKontoinhaberVorname(e.target.value)}
                />
                {step3Errors.kontohaberVorname && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertTriangle size={12} />
                    {step3Errors.kontohaberVorname}
                  </p>
                )}
              </div>

              {/* Kontoinhaber Nachname */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="kontoinhaber-nachname">
                  Nachname des Kontoinhabers
                  {isRueckerstattung && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  id="kontoinhaber-nachname"
                  type="text"
                  placeholder="Nachname"
                  value={kontohaberNachname}
                  onChange={e => setKontoinhaberNachname(e.target.value)}
                />
                {step3Errors.kontohaberNachname && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertTriangle size={12} />
                    {step3Errors.kontohaberNachname}
                  </p>
                )}
              </div>
            </div>

            {/* IBAN */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="iban">
                IBAN
                {isRueckerstattung && <span className="text-destructive"> *</span>}
              </label>
              <Input
                id="iban"
                type="text"
                placeholder="DE00 0000 0000 0000 0000 00"
                value={iban}
                onChange={e => setIban(e.target.value.toUpperCase())}
                className="font-mono"
              />
              {step3Errors.iban && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {step3Errors.iban}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* BIC */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="bic">
                  BIC
                  {isRueckerstattung && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  id="bic"
                  type="text"
                  placeholder="XXXXXXXX"
                  value={bic}
                  onChange={e => setBic(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                {step3Errors.bic && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertTriangle size={12} />
                    {step3Errors.bic}
                  </p>
                )}
              </div>

              {/* Bank */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="bank">
                  Bank
                  {isRueckerstattung && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  id="bank"
                  type="text"
                  placeholder="Name der Bank"
                  value={bank}
                  onChange={e => setBank(e.target.value)}
                />
                {step3Errors.bank && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertTriangle size={12} />
                    {step3Errors.bank}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
              <IconAlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Fehler beim Speichern</p>
                <p className="text-xs text-destructive/80 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex items-center gap-2">
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Überzahlung speichern
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ---- STEP 4: Abschluss ---- */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Success Card */}
          <div className="bg-card rounded-2xl border p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
            </div>
            <h2 className="text-xl font-bold mb-1">Überzahlung erfasst!</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Die Überzahlung wurde erfolgreich erfasst und gespeichert.
              {createdRecordId && (
                <span className="block mt-1 text-xs font-mono text-muted-foreground/70">
                  Datensatz-ID: {createdRecordId}
                </span>
              )}
            </p>
          </div>

          {/* Summary */}
          {selectedForderung && (
            <div className="bg-secondary rounded-2xl border p-5">
              <h3 className="text-sm font-semibold mb-3">Zusammenfassung</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Forderung</p>
                  <p className="font-medium truncate">
                    {selectedForderung.fields.rechnungsnummer ?? selectedForderung.record_id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Überzahlter Betrag</p>
                  <p className="font-medium">{formatEuro(parseFloat(ueberzahlterBetrag) || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Eingangsdatum</p>
                  <p className="font-medium">{eingangsdatumZahlung || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Maßnahme</p>
                  <p className="font-medium">{massnahmeLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bearbeitungsstatus</p>
                  <p className="font-medium">{bearbeitungsstatusLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bearbeitungsdatum</p>
                  <p className="font-medium">{new Date().toISOString().split('T')[0]}</p>
                </div>
                {(kontohaberVorname || kontohaberNachname) && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">Kontoinhaber</p>
                    <p className="font-medium">{[kontohaberVorname, kontohaberNachname].filter(Boolean).join(' ')}</p>
                  </div>
                )}
                {iban && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">IBAN</p>
                    <p className="font-medium font-mono">{iban}</p>
                  </div>
                )}
                {bemerkungen && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">Bemerkungen</p>
                    <p className="font-medium">{bemerkungen}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline" className="flex-1 flex items-center justify-center gap-2">
              <IconFileInvoice size={16} />
              Weitere Überzahlung bearbeiten
            </Button>
            <a href="#/" className="flex-1">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
