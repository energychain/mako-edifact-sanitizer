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
  assert.match(result.sanitizedEdifact, /UNT\+10\+1'UNZ\+1\+MSCONS1'/);
  assert.doesNotMatch(result.sanitizedEdifact, /9900000000001|9900000000002|DE0012345678901234567890123456789|Max Mustermann|max\.mustermann@example\.test|\+491711234567/);
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
