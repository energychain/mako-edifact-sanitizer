const crypto = require('node:crypto');

const caseStores = new Map();

function defaultSeparators(text) {
  // UNA:+.? ' => component :, data +, decimal ., release ?, reserved space, segment '
  if (text.startsWith('UNA') && text.length >= 9) {
    return {
      component: text[3],
      data: text[4],
      decimal: text[5],
      release: text[6],
      reserved: text[7],
      segment: text[8],
      una: text.slice(0, 9),
    };
  }
  return { component: ':', data: '+', decimal: '.', release: '?', reserved: ' ', segment: "'", una: null };
}

function splitSegments(text, separators) {
  const segments = [];
  let buf = '';
  let escaped = false;
  const start = separators.una ? 9 : 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === separators.release) {
      escaped = true;
      continue;
    }
    if (ch === separators.segment) {
      segments.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) segments.push(buf);
  return segments;
}

function parseMessageTypes(segments, separators) {
  const result = {};
  for (const segment of segments) {
    if (segment.startsWith('UNH' + separators.data)) {
      const parts = segment.slice(0, -1).split(separators.data);
      const type = (parts[2] || '').split(separators.component)[0];
      if (type) result[type] = (result[type] || 0) + 1;
    }
  }
  return result;
}

function storeFor(options) {
  if (!options.caseStable) return { maps: {}, counters: {} };
  const key = options.caseId || 'default';
  if (!caseStores.has(key)) caseStores.set(key, { maps: {}, counters: {} });
  return caseStores.get(key);
}

function nextAlias(state, cls, prefix) {
  state.counters[cls] = (state.counters[cls] || 0) + 1;
  return `${prefix}_${state.counters[cls]}`;
}

function addReplacement(report, cls, confidence = 'medium') {
  if (!report.replacementsByClass[cls]) report.replacementsByClass[cls] = { count: 0, confidence };
  report.replacementsByClass[cls].count += 1;
}

function maybeDebugRaw(report, cls, value) {
  if (!report.includeRawValues) return;
  if (!report.debugRawValues[cls]) report.debugRawValues[cls] = [];
  if (!report.debugRawValues[cls].includes(value)) report.debugRawValues[cls].push(value);
}

function aliasFor(state, report, cls, raw, factory, confidence = 'medium') {
  if (!raw) return raw;
  if (!state.maps[cls]) state.maps[cls] = new Map();
  if (!state.maps[cls].has(raw)) {
    state.maps[cls].set(raw, factory(raw));
    addReplacement(report, cls, confidence);
    maybeDebugRaw(report, cls, raw);
  }
  return state.maps[cls].get(raw);
}

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8).toUpperCase();
}

function inferRoleAlias(segment, code, raw, actorIndex) {
  // EDIFACT NAD party qualifiers vary by process. For MVP default to message-local MP_A/MP_B;
  // include role hints in the report instead of over-claiming role certainty.
  if (actorIndex === 0) return 'MP_A';
  if (actorIndex === 1) return 'MP_B';
  return `MP_${String.fromCharCode(65 + actorIndex)}`;
}

function sanitizeMarketPartners(text, state, report, separators) {
  const seen = [];
  return text.replace(/\b99\d{11}\b/g, (raw, offset, full) => {
    if (!seen.includes(raw)) seen.push(raw);
    const idx = seen.indexOf(raw);
    const alias = aliasFor(state, report, 'marketPartner', raw, () => inferRoleAlias(full, null, raw, idx), 'high');
    return alias;
  });
}

function sanitizeLocations(text, state, report) {
  return text.replace(/\bDE\d{31,33}\b/g, (raw) =>
    aliasFor(state, report, 'location', raw, () => `LOC_${shortHash(raw)}`, 'high')
  );
}

function sanitizeEmails(text, state, report) {
  // Deliberately do not allow EDIFACT data separator '+' in the local part;
  // otherwise `COM+name@example` would be consumed as one e-mail token.
  return text.replace(/(?<![A-Z0-9._%-])[A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (raw) =>
    aliasFor(state, report, 'email', raw, () => nextAlias(state, 'emailAlias', 'EMAIL'), 'high')
  );
}

function sanitizePhones(text, state, report) {
  return text.replace(/(?<![A-Z0-9_])(?:\+49|0049|0)[1-9][0-9\s/().-]{5,}[0-9](?![A-Z0-9_])/g, (raw) =>
    aliasFor(state, report, 'phone', raw, () => nextAlias(state, 'phoneAlias', 'PHONE'), 'medium')
  );
}

function sanitizeQualifiedReferences(text, state, report) {
  return text.replace(/(RFF\+(?:Z13|AGK|TN|ON|VN|ACW):)([^+'\s]+)/g, (m, prefix, raw) => {
    const clsByPrefix = { Z13: 'meterOrDevice', AGK: 'contract', TN: 'invoice', ON: 'order', VN: 'contract', ACW: 'customer' };
    const qualifier = prefix.match(/RFF\+([^:]+):/)[1];
    const cls = clsByPrefix[qualifier] || 'reference';
    const pfx = cls === 'meterOrDevice' ? 'METER' : cls.toUpperCase();
    return prefix + aliasFor(state, report, cls, raw, () => `${pfx}_${shortHash(raw)}`, 'medium');
  });
}

function sanitizeBgmReferences(text, state, report) {
  return text.replace(/(BGM\+[^+']+\+)([^+']+)(\+)/g, (m, prefix, raw, suffix) => {
    return prefix + aliasFor(state, report, 'caseReference', raw, () => `CASE_${shortHash(raw)}`, 'medium') + suffix;
  });
}

function sanitizeContacts(text, state, report) {
  let out = text;
  out = out.replace(/(CTA\+[^+']*\+:)([^+']+)/g, (m, prefix, raw) =>
    prefix + aliasFor(state, report, 'person', raw, () => nextAlias(state, 'personAlias', 'PERSON'), 'medium')
  );
  out = out.replace(/(Kunde\s+)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+)/g, (m, prefix, raw) =>
    prefix + aliasFor(state, report, 'person', raw, () => nextAlias(state, 'personAlias', 'PERSON'), 'low')
  );
  return out;
}

function sanitizeNadFreeText(text, state, report) {
  // Synthetic/open fixture company/address strings are also pseudonymized so cases can be shared safely.
  return text.replace(/(NAD\+[^+']+\+[^+']*\+\+)([^+']*)(\+)([^+']*)(\+)([^+']*)(\+\+?)([0-9]{5})(\+DE)/g,
    (m, prefix, company, s1, street, s2, city, s3, zip, suffix) => {
      const companyAlias = aliasFor(state, report, 'organizationName', company, () => nextAlias(state, 'orgAlias', 'ORG'), 'medium');
      const streetAlias = aliasFor(state, report, 'address', street, () => nextAlias(state, 'addressAlias', 'ADDRESS'), 'medium');
      const cityAlias = aliasFor(state, report, 'address', city, () => nextAlias(state, 'cityAlias', 'CITY'), 'low');
      const zipAlias = aliasFor(state, report, 'address', zip, () => nextAlias(state, 'zipAlias', 'ZIP'), 'low');
      return prefix + companyAlias + s1 + streetAlias + s2 + cityAlias + s3 + zipAlias + suffix;
    });
}

function detectWarnings(sanitized, warnings) {
  if (/\bDE\d{10,}\b/.test(sanitized)) warnings.push({ code: 'sensitive-looking-location-left', confidence: 'low' });
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(sanitized)) warnings.push({ code: 'email-left', confidence: 'high' });
  if (/\b99\d{11}\b/.test(sanitized)) warnings.push({ code: 'market-partner-left', confidence: 'medium' });
}

function sanitize(edifactText, options = {}) {
  if (typeof edifactText !== 'string') throw new TypeError('sanitize(edifactText) expects a string');
  const state = storeFor(options);
  const separators = defaultSeparators(edifactText);
  const segments = splitSegments(edifactText, separators);
  const warnings = [];
  if (options.apiKey || process.env.CERNION_API_KEY) {
    warnings.push({ code: 'api-key-present-unused-in-mvp', message: 'MVP keeps offline/fallback mode; token value is neither logged nor sent.', confidence: 'high' });
  } else {
    warnings.push({ code: 'offline-market-partner-lookup', message: 'No Cernion API lookup used; role aliases are message-local/fallback confidence.', confidence: 'medium' });
  }
  const report = {
    schemaVersion: '0.1.0',
    includeRawValues: Boolean(options.debugIncludeRawValues),
    summary: { segments: segments.length, warnings: warnings.length },
    messageTypes: parseMessageTypes(segments, separators),
    replacementsByClass: {},
    pseudoMap: {
      marketPartner: { strategy: 'message-local A/B aliases', count: 0 },
      location: { strategy: 'deterministic hash aliases', count: 0 },
      other: { strategy: 'class counters or deterministic hash aliases' },
    },
    designHooks: {
      supportedFirst: ['MSCONS', 'UTILMD', 'APERAK'],
      placeholders: ['INVOIC', 'PRICAT'],
      cernionApiKeyEnv: 'CERNION_API_KEY',
    },
  };
  if (report.includeRawValues) report.debugRawValues = {};

  let out = edifactText;
  out = sanitizeMarketPartners(out, state, report, separators);
  out = sanitizeLocations(out, state, report);
  out = sanitizeEmails(out, state, report);
  out = sanitizePhones(out, state, report);
  out = sanitizeQualifiedReferences(out, state, report);
  out = sanitizeBgmReferences(out, state, report);
  out = sanitizeContacts(out, state, report);
  out = sanitizeNadFreeText(out, state, report);
  detectWarnings(out, warnings);

  report.summary.warnings = warnings.length;
  report.pseudoMap.marketPartner.count = state.maps.marketPartner ? state.maps.marketPartner.size : 0;
  report.pseudoMap.location.count = state.maps.location ? state.maps.location.size : 0;
  return { sanitizedEdifact: out, report, warnings };
}

module.exports = { sanitize, _internal: { defaultSeparators, splitSegments } };
