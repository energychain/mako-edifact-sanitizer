const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitize } = require('../src');

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');
}

test('sanitize preserves EDIFACT envelopes and segment order for MSCONS while pseudonymizing identifiers', () => {
  const input = fixture('mscons.synthetic.edi');
  const result = sanitize(input);
  assert.match(result.sanitizedEdifact, /^UNA:\+.\? 'UNB\+/);
  assert.match(result.sanitizedEdifact, /UNH\+1\+MSCONS/);
  assert.match(result.sanitizedEdifact, /UNT\+10\+1'UNZ\+1\+DAREF_[A-F0-9]{8}'/);
  assert.doesNotMatch(result.sanitizedEdifact, /9900000000001|9900000000002|DE0012345678901234567890123456789|Max Mustermann|max\.mustermann@example\.test|\+491711234567/);
  assert.doesNotMatch(JSON.stringify(result.report), /9900000000001|9900000000002|DE0012345678901234567890123456789|Max Mustermann|max\.mustermann@example\.test|\+491711234567/);
  assert.match(result.sanitizedEdifact, /MP_A|MP_B|LOC_[A-Z0-9_]+|PERSON_1|EMAIL_1|PHONE_1/);
  assert.match(result.sanitizedEdifact, /COM\+EMAIL_1:EM'COM\+PHONE_1:TE'/);
  assert.equal(result.report.includeRawValues, false);
  assert.equal(result.report.messageTypes.MSCONS, 1);
});

test('sanitize handles UTILMD and APERAK fixtures without raw sensitive originals in default report', () => {
  for (const name of ['utilmd.synthetic.edi', 'aperak.synthetic.edi']) {
    const input = fixture(name);
    const result = sanitize(input);
    const serializedReport = JSON.stringify(result.report);
    for (const forbidden of ['9900000000003', '9900000000004', '9900000000005', '9900000000006', 'Erika Beispiel', 'Hans Privat', 'erika.beispiel@example.test', 'VERTRAG-987654321', 'RECHNUNG-2026-0001']) {
      assert.equal(serializedReport.includes(forbidden), false, `${name} report leaked ${forbidden}`);
      assert.equal(result.sanitizedEdifact.includes(forbidden), false, `${name} output leaked ${forbidden}`);
    }
    assert.ok(Object.keys(result.report.replacementsByClass).length > 0);
    assert.ok(Array.isArray(result.warnings));
  }
});

test('caseStable option reuses aliases across multi-message bundles', () => {
  const first = sanitize(fixture('mscons.synthetic.edi'), { caseStable: true, caseId: 'bundle-1' });
  const second = sanitize(fixture('mscons.synthetic.edi'), { caseStable: true, caseId: 'bundle-1' });
  assert.equal(first.sanitizedEdifact, second.sanitizedEdifact);
  assert.equal(first.report.pseudoMap.marketPartner.count, 2);
});

test('debugIncludeRawValues is explicit opt-in', () => {
  const result = sanitize(fixture('mscons.synthetic.edi'), { debugIncludeRawValues: true });
  assert.equal(result.report.includeRawValues, true);
  assert.ok(result.report.debugRawValues.marketPartner.length >= 2);
});

test('sanitize masks INVOIC NAD organization and address free text while preserving dates', () => {
  const input = fixture('invoic.nad-address-regression.synthetic.edi');
  const result = sanitize(input);
  const reportJson = JSON.stringify(result.report);
  const forbidden = [
    'Regionalwerke Beispiel GmbH',
    'Lieferant Beispiel GmbH & Co. KG',
    'Hauptstr.',
    'Parsevalstr.',
    'Wiesenstr.',
    'Musterstadt',
    'Beispielstadt',
    '37170',
    '40468',
  ];
  for (const raw of forbidden) {
    assert.equal(result.sanitizedEdifact.includes(raw), false, `sanitized output leaked ${raw}`);
    assert.equal(reportJson.includes(raw), false, `report leaked ${raw}`);
  }
  assert.match(result.sanitizedEdifact, /NAD\+MS\+PARTY_[A-F0-9]{8}::293\+\+ADDR_[A-F0-9]{8}\+ADDR_[A-F0-9]{8}\+ADDR_[A-F0-9]{8}\+\+ADDR_[A-F0-9]{8}\+DE'/);
  assert.match(result.sanitizedEdifact, /DTM\+137:202607151442\?\+00:303'/);
  assert.doesNotMatch(result.sanitizedEdifact, /DTM\+137:[^']*PHONE_/);
});

test('sanitize removes real-world identifier references without masking quantities or amounts', () => {
  const input = [
    "UNB+UNOC:3+9900000000123:500+9900000000456:500+260824:1200+DAREF-REAL-123456'",
    "UNH+4711+INVOIC:D:01B:UN:2.5'",
    "BGM+380+INV-2026-000012345+9'",
    "DTM+137:202608241200:203'",
    "NAD+MS+9900000000123::9++Real Lieferant GmbH+Musterstrasse 12+Berlin++10115+DE'",
    "NAD+MR+9900000000456::9++Beispiel Netz AG+Netzweg 7+Hamburg++20095+DE'",
    "NAD+DP++40123456789::9'",
    "LOC+172+DE0012345678901234567890123456789'",
    "RFF+Z13:1ABCDEF234567890'",
    "RFF+TN:RECHNUNG-2026-000012345'",
    "RFF+ADE:DATENAUSTAUSCH-REF-987654321'",
    "FII+RB+DE44500105175407324931'",
    "CTA+IC+:Erika Beispiel'",
    "COM+erika.beispiel@example.test:EM'",
    "COM+00491711234567:TE'",
    "COM+?:3677788215:TE'",
    "DOC+380+DOC-CASE-2026-123456789'",
    "IDE+24+GERAET-998877665544'",
    "MOA+9:1234567890.12'",
    "QTY+47:9876543210'",
    "CNT+2:1234567890'",
    "UNT+19+4711'",
    "UNZ+1+DAREF-REAL-123456'",
  ].join('');
  const result = sanitize(input);
  const reportJson = JSON.stringify(result.report);
  const forbidden = [
    '9900000000123',
    '9900000000456',
    'DAREF-REAL-123456',
    'INV-2026-000012345',
    'DE0012345678901234567890123456789',
    '40123456789',
    '1ABCDEF234567890',
    'RECHNUNG-2026-000012345',
    'DATENAUSTAUSCH-REF-987654321',
    'DE44500105175407324931',
    'Erika Beispiel',
    'erika.beispiel@example.test',
    '00491711234567',
    '3677788215',
    'DOC-CASE-2026-123456789',
    'GERAET-998877665544',
  ];
  for (const raw of forbidden) {
    assert.equal(result.sanitizedEdifact.includes(raw), false, `sanitized output leaked ${raw}`);
    assert.equal(reportJson.includes(raw), false, `report leaked ${raw}`);
  }
  assert.match(result.sanitizedEdifact, /MOA\+9:1234567890\.12'/);
  assert.match(result.sanitizedEdifact, /QTY\+47:9876543210'/);
  assert.match(result.sanitizedEdifact, /CNT\+2:1234567890'/);
});
