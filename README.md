# mako-edifact-sanitizer

Open-source-ready MVP for transforming synthetic or approved MaKo EDIFACT messages into structurally intact, shareable pseudonymized cases.

Safety boundary: this is an anonymization/pseudonymization aid, not a guaranteed full DSGVO anonymization mechanism and not legal advice. Review results before sharing externally. Do not use real customer or mixed-sensitive EDIFACT data without separate approval and a suitable processing/legal setup.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/energychain/mako-edifact-sanitizer)

## Quick Start

Install globally from npm:

```bash
npm install -g mako-edifact-sanitizer
mako-sanitizer input.edi --out sanitized.edi --report report.json
```

The long binary stays available for compatibility:

```bash
mako-edifact-sanitizer input.edi --out sanitized.edi --report report.json
```

For a clean checkout or cloud workspace:

```bash
git clone https://github.com/energychain/mako-edifact-sanitizer.git
cd mako-edifact-sanitizer
npm test
npm run smoke
node bin/mako-edifact-sanitizer.js fixtures/mscons.synthetic.edi --out sanitized.edi --report report.json
```

```bash
npx github:energychain/mako-edifact-sanitizer fixtures/mscons.synthetic.edi --out sanitized.edi --report report.json
```

Browser/cloud workspaces:

- Gitpod: https://gitpod.io/#https://github.com/energychain/mako-edifact-sanitizer
- StackBlitz: https://stackblitz.com/fork/github/energychain/mako-edifact-sanitizer?title=MaKo%20EDIFACT%20Sanitizer
- GitHub Codespaces also works from the repository page.

## Static Web UI

Open `web/index.html` from a checkout or from a static file host for an offline-first browser UI:

1. Paste EDIFACT into the input field.
2. Confirm that the page is only a local example and not legal anonymization advice.
3. Click **Im Browser pseudonymisieren**.
4. Copy or download `sanitized.edi` and `report.json`.

The page loads `web/mako-edifact-sanitizer.browser.js`, a generated bundle built from the library implementation in `src/index.js`. It does not maintain a separate inline sanitizer fork. The page has no telemetry, no external APIs, and no EDIFACT upload path; it ships only with synthetic sample data and repeats the same limitation as the CLI/library: this is a pseudonymization aid, not guaranteed DSGVO anonymization or legal advice.

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

NPM bin names:

```bash
mako-sanitizer input.edi --out sanitized.edi --report report.json
mako-edifact-sanitizer input.edi --out sanitized.edi --report report.json
mako-sanitizer --version
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
npm run build:web
npm run smoke
npm pack --json
npm run smoke:global-install
```

`npm run build:web` regenerates the browser bundle from `src/index.js`. `npm run smoke` performs the CLI smoke, real packed-tarball global-install smoke for both npm bin names, and a static Web UI smoke that verifies WebUI output matches the library output for synthetic fixtures and the INVOIC NAD-address regression fixture.

The default report stores categories and counts only. Raw originals are only included with `--debug-include-raw-values` / `debugIncludeRawValues: true` for local debugging and must not be used in shareable reports.
