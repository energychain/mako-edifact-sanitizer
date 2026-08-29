const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { sanitize } = require('../src');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin', 'mako-edifact-sanitizer.js');

function runCli(args, input) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
  });
}

function fixture(name) {
  return fs.readFileSync(path.join(root, 'fixtures', name), 'utf8');
}

function loadBrowserBundle() {
  const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-web-bundle.js')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const context = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(path.join(root, 'web', 'mako-edifact-sanitizer.browser.js'), 'utf8'),
    context
  );
  assert.equal(typeof context.MakoEdifactSanitizer.sanitize, 'function');
  return context.MakoEdifactSanitizer;
}

test('package exposes long and short npm bin names', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.bin['mako-edifact-sanitizer'], 'bin/mako-edifact-sanitizer.js');
  assert.equal(pkg.bin['mako-sanitizer'], 'bin/mako-edifact-sanitizer.js');
  assert.ok(pkg.files.includes('web/'));
});

test('cli help documents the short npm alias and version option', () => {
  for (const flag of ['--help', '-h']) {
    const result = runCli([flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: mako-sanitizer \[input\.edi\]/);
    assert.match(result.stdout, /mako-edifact-sanitizer/);
    assert.match(result.stdout, /--version/);
    assert.equal(result.stderr, '');
  }
});

test('cli version prints package version without reading stdin', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const flag of ['--version', '-v']) {
    const result = runCli([flag]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), pkg.version);
    assert.equal(result.stderr, '');
  }
});

test('static web ui loads generated library bundle instead of inline sanitizer fork', () => {
  const html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  assert.match(html, /EDIFACT-Nachricht einfügen/);
  assert.match(html, /pseudonymization aid|Pseudonymisierungs-Hilfsmittel/i);
  assert.match(html, /Keine Übertragung/);
  assert.match(html, /mako-edifact-sanitizer\.browser\.js/);
  assert.doesNotMatch(html, /function\s+sanitizeText\s*\(/);
  assert.doesNotMatch(html, /fetch\s*\(/i);
  assert.doesNotMatch(html, /XMLHttpRequest/i);
  assert.doesNotMatch(html, /sendBeacon/i);
  assert.doesNotMatch(html, /WebSocket/i);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i);
});

test('generated browser bundle matches library sanitizer for fixtures and INVOIC regression', () => {
  const browser = loadBrowserBundle();
  for (const name of [
    'mscons.synthetic.edi',
    'utilmd.synthetic.edi',
    'aperak.synthetic.edi',
    'invoic.nad-address-regression.synthetic.edi',
  ]) {
    const input = fixture(name);
    const webResult = browser.sanitize(input);
    const libraryResult = sanitize(input);
    assert.equal(webResult.sanitizedEdifact, libraryResult.sanitizedEdifact, name);
    assert.equal(JSON.stringify(webResult.report), JSON.stringify(libraryResult.report), name);
  }
});

test('browser bundle includes the INVOIC NAD address leak regression behavior', () => {
  const browser = loadBrowserBundle();
  const result = browser.sanitize(fixture('invoic.nad-address-regression.synthetic.edi'));
  const reportJson = JSON.stringify(result.report);
  for (const raw of [
    'Regionalwerke Beispiel GmbH',
    'Lieferant Beispiel GmbH & Co. KG',
    'Hauptstr.',
    'Parsevalstr.',
    'Musterstadt',
    '37170',
  ]) {
    assert.equal(result.sanitizedEdifact.includes(raw), false, `browser output leaked ${raw}`);
    assert.equal(reportJson.includes(raw), false, `browser report leaked ${raw}`);
  }
});
