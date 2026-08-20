#!/usr/bin/env node
const fs = require('node:fs');
const { sanitize } = require('../src');

function usage(exitCode = 0) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(`Usage: mako-edifact-sanitizer [input.edi] [--out sanitized.edi] [--report report.json] [--api-key KEY] [--debug-include-raw-values]\n\nIf input is omitted or '-', EDIFACT is read from stdin and sanitized EDIFACT is written to stdout.\nCERNION_API_KEY is accepted for later lookup integration; the MVP works offline and never prints token values.\n`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);
let inputPath = null;
let outPath = null;
let reportPath = null;
let apiKey = process.env.CERNION_API_KEY || null;
let debugIncludeRawValues = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') usage(0);
  if (arg === '--out') { outPath = args[++i]; continue; }
  if (arg === '--report') { reportPath = args[++i]; continue; }
  if (arg === '--api-key') { apiKey = args[++i] || ''; continue; }
  if (arg === '--debug-include-raw-values') { debugIncludeRawValues = true; continue; }
  if (arg.startsWith('--')) {
    process.stderr.write(`Unknown option: ${arg}\n`);
    usage(2);
  }
  if (inputPath) {
    process.stderr.write(`Unexpected extra input: ${arg}\n`);
    usage(2);
  }
  inputPath = arg;
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

const input = !inputPath || inputPath === '-' ? readStdin() : fs.readFileSync(inputPath, 'utf8');
const result = sanitize(input, { apiKey, debugIncludeRawValues });
if (outPath) fs.writeFileSync(outPath, result.sanitizedEdifact);
else process.stdout.write(result.sanitizedEdifact);
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2) + '\n');
if (result.warnings.length && outPath) {
  process.stderr.write(`mako-edifact-sanitizer: ${result.warnings.length} warning(s); see report for classes, no raw values by default.\n`);
}
