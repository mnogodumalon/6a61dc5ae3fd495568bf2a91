import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/DatePicker';
import { lookupKey } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a61dc5ba21f30738c093acf';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormUeberzahlungsbearbeitung() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Überzahlungsbearbeitung — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="ueberzahlter_betrag">Überzahlter Betrag (€) *</Label>
            <Input
              id="ueberzahlter_betrag"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.ueberzahlter_betrag ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, ueberzahlter_betrag: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eingangsdatum_zahlung">Eingangsdatum der Zahlung</Label>
            <DatePicker
              id="eingangsdatum_zahlung"
              placeholder=""
              mode="date"
              value={fields.eingangsdatum_zahlung ?? null}
              onChange={v => setFields(f => ({ ...f, eingangsdatum_zahlung: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="massnahme">Maßnahme *</Label>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.massnahme) === 'rueckerstattung'}
                onClick={() => setFields(f => ({ ...f, massnahme: (lookupKey(f.massnahme) === 'rueckerstattung' ? undefined : 'rueckerstattung') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.massnahme) === 'rueckerstattung'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Rückerstattung
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.massnahme) === 'verrechnung'}
                onClick={() => setFields(f => ({ ...f, massnahme: (lookupKey(f.massnahme) === 'verrechnung' ? undefined : 'verrechnung') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.massnahme) === 'verrechnung'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Verrechnung mit anderer Forderung
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.massnahme) === 'gutschrift'}
                onClick={() => setFields(f => ({ ...f, massnahme: (lookupKey(f.massnahme) === 'gutschrift' ? undefined : 'gutschrift') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.massnahme) === 'gutschrift'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Gutschrift
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.massnahme) === 'sonstiges'}
                onClick={() => setFields(f => ({ ...f, massnahme: (lookupKey(f.massnahme) === 'sonstiges' ? undefined : 'sonstiges') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.massnahme) === 'sonstiges'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Sonstiges
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bearbeitungsstatus">Bearbeitungsstatus *</Label>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.bearbeitungsstatus) === 'offen'}
                onClick={() => setFields(f => ({ ...f, bearbeitungsstatus: (lookupKey(f.bearbeitungsstatus) === 'offen' ? undefined : 'offen') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.bearbeitungsstatus) === 'offen'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Offen
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.bearbeitungsstatus) === 'in_bearbeitung'}
                onClick={() => setFields(f => ({ ...f, bearbeitungsstatus: (lookupKey(f.bearbeitungsstatus) === 'in_bearbeitung' ? undefined : 'in_bearbeitung') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.bearbeitungsstatus) === 'in_bearbeitung'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                In Bearbeitung
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.bearbeitungsstatus) === 'abgeschlossen'}
                onClick={() => setFields(f => ({ ...f, bearbeitungsstatus: (lookupKey(f.bearbeitungsstatus) === 'abgeschlossen' ? undefined : 'abgeschlossen') as any }))}
                className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.bearbeitungsstatus) === 'abgeschlossen'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Abgeschlossen
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bearbeitungsdatum">Bearbeitungsdatum</Label>
            <DatePicker
              id="bearbeitungsdatum"
              placeholder=""
              mode="date"
              value={fields.bearbeitungsdatum ?? null}
              onChange={v => setFields(f => ({ ...f, bearbeitungsdatum: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontoinhaber_vorname">Kontoinhaber Vorname</Label>
            <Input
              id="kontoinhaber_vorname"
              placeholder=""
              value={fields.kontoinhaber_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, kontoinhaber_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontoinhaber_nachname">Kontoinhaber Nachname</Label>
            <Input
              id="kontoinhaber_nachname"
              placeholder=""
              value={fields.kontoinhaber_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, kontoinhaber_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              placeholder=""
              value={fields.iban ?? ''}
              onChange={e => setFields(f => ({ ...f, iban: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bic">BIC</Label>
            <Input
              id="bic"
              placeholder=""
              value={fields.bic ?? ''}
              onChange={e => setFields(f => ({ ...f, bic: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank">Kreditinstitut</Label>
            <Input
              id="bank"
              placeholder=""
              value={fields.bank ?? ''}
              onChange={e => setFields(f => ({ ...f, bank: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bemerkungen">Bemerkungen</Label>
            <Textarea
              id="bemerkungen"
              placeholder=""
              value={fields.bemerkungen ?? ''}
              onChange={e => setFields(f => ({ ...f, bemerkungen: e.target.value }))}
              rows={3}
            />
          </div>

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
