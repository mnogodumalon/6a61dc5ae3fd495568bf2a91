// Auto-generated. Per-entity form-enhancements config for "Forderungserfassung".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["rechnungsnummer", {"row": ["rechnungsdatum", "faelligkeitsdatum"]}, {"row": ["rechnungsbetrag", "gezahlter_betrag"]}, "zahlungsstatus", "schuldner", "notizen_forderung"],
  defaults: {
    "rechnungsdatum": { kind: "today" },
    "faelligkeitsdatum": { kind: "todayOffset", days: 14 },
    "zahlungsstatus": { kind: "lookup", key: "offen", label: "Offen" },
    "gezahlter_betrag": { kind: "literal", value: 0 },
  },
  computed: {
    '_ausstehender_betrag': { op: 'sub', left: { kind: 'field', key: 'rechnungsbetrag' }, right: { kind: 'field', key: 'gezahlter_betrag' } },
  },
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {};

// Build-time-populated applookup (ownKey → lookupKey) pairs found in MODUS-2
// arrow functions. Filled by scripts/parse-formulas.mjs from regex matches
// on `ctx.applookup('x','y')` and `ctx.applookupAny('x','y')`. The dialog
// merges this with MODUS-1 refs extracted at render time, so every numeric
// field the formula pulls from a selected lookup is surfaced as an inline
// hint next to the lookup combobox.
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
