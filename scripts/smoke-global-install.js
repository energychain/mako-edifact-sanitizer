const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mako-sanitizer-global-'));
const prefix = path.join(tmp, 'prefix');
const userconfig = path.join(tmp, 'npmrc');
fs.writeFileSync(userconfig, 'fund=false\naudit=false\n');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_userconfig: userconfig,
      NPM_CONFIG_USERCONFIG: userconfig,
    },
  });
  if (result.status !== 0) {
    process.stderr.write(`Command failed: ${command} ${args.join(' ')}\n`);
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
  return result;
}

run(process.execPath, [path.join(root, 'scripts', 'build-web-bundle.js')]);
const pack = run('npm', ['pack', '--json']);
const packed = JSON.parse(pack.stdout)[0];
const tarball = path.join(root, packed.filename);
run('npm', ['install', '--global', '--prefix', prefix, tarball]);

for (const binName of ['mako-edifact-sanitizer', 'mako-sanitizer']) {
  const binPath = path.join(prefix, 'bin', binName);
  const version = run(binPath, ['--version']);
  if (version.stdout.trim() !== packed.version) {
    process.stderr.write(`${binName} --version returned ${JSON.stringify(version.stdout.trim())}, expected ${packed.version}\n`);
    process.exit(1);
  }

  const help = run(binPath, ['--help']);
  if (!help.stdout.includes('mako-sanitizer') || !help.stdout.includes('--version')) {
    process.stderr.write(`${binName} --help did not document expected usage/options\n`);
    process.exit(1);
  }
}

if (!packed.files.some((file) => file.path === 'web/index.html')) {
  throw new Error('packed npm tarball is missing web/index.html');
}
if (!packed.files.some((file) => file.path === 'web/mako-edifact-sanitizer.browser.js')) {
  throw new Error('packed npm tarball is missing generated browser bundle');
}

process.stdout.write(`global install smoke ok: ${packed.filename}\n`);
