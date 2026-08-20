# mako-edifact-sanitizer

Open-source-ready MVP for transforming synthetic or approved MaKo EDIFACT messages into structurally intact, shareable pseudonymized cases.

Safety boundary: this is an anonymization/pseudonymization aid, not a guaranteed full DSGVO anonymization mechanism and not legal advice. Review results before sharing externally. Do not use real customer or mixed-sensitive EDIFACT data without separate approval and a suitable processing/legal setup.

## Library API

```js
const { sanitize } = require('mako-edifact-sanitizer');
const { sanitizedEdifact, report, warnings } = sanitize(edifactText, {
  caseStable: true,
  caseId: 'bundle-1',
  // Explicit opt-in only; default reports never include raw originals.
  debugIncludeRawValues: false,
});
```

Return shape:

- `sanitizedEdifact`: EDIFACT text with segment order, separators, qualifiers, references and payload shape preserved as far as the MVP parser can.
- `report`: counts/classes, pseudo-map categories, message type summary, design hooks.
- `warnings`: confidence and fallback notices, e.g. offline market-partner lookup.

## CLI

```bash
node bin/mako-edifact-sanitizer.js fixtures/mscons.synthetic.edi --out sanitized.edi --report report.json
cat fixtures/mscons.synthetic.edi | node bin/mako-edifact-sanitizer.js - > sanitized.edi
```

Later NPM bin name:

```bash
mako-edifact-sanitizer input.edi --out sanitized.edi --report report.json
```

## API key path

The CLI accepts `--api-key` and the library observes `CERNION_API_KEY` for a future Cernion Energy Tools market-partner lookup path. The MVP intentionally works offline/fallback-only and does not send lookup calls. Do not hardcode, commit, log or print token values. Users can create an API key at https://cernion.de/cet-token.

## MVP coverage

Synthetic fixtures and tests cover MSCONS, UTILMD and APERAK. INVOIC/PRICAT are represented as design hooks/placeholders for a later iteration.

Detected/pseudonymized classes include:

- MaLo/MeLo/Zählpunkt-like `DE...` location identifiers
- BDEW/market-partner-like `99...` codes with message-local `MP_A`, `MP_B` aliases
- names, organization names, addresses, e-mail and telephone
- customer/contract/invoice/device/meter-like qualified references

## Verification

```bash
npm test
npm run smoke
```

The default report stores categories and counts only. Raw originals are only included with `--debug-include-raw-values` / `debugIncludeRawValues: true` for local debugging and must not be used in shareable reports.
