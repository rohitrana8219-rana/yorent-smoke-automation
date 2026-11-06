const fs = require('fs');
const path = require('path');
const { randomBytes, createHash } = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help' || args.includes('--help')) {
    console.log('full [--headed|--list]: complete 60-test checklist with fresh records.');
    console.log('cancel|refund [--source-run <completed rental ID>] [--run <smoke ID>] [--headed|--list]');
    console.log('A new standalone run creates a distinct order. --run verifies/resumes that same branch safely.');
    return;
  }
  if (!['full', 'cancel', 'refund'].includes(mode)) throw new Error('Choose full, cancel, or refund.');
  const take = flag => {
    const index = args.indexOf(flag);
    if (index < 0) return null;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} requires a value.`);
    return args.splice(index, 2)[1];
  };
  const selected = take('--run');
  const selectedSource = take('--source-run');
  const until = take('--until');
  const prepareIndex = args.indexOf('--prepare-only');
  const prepareOnly = prepareIndex >= 0;
  if (prepareOnly) args.splice(prepareIndex, 1);
  if (mode === 'full' && (prepareOnly || until || selectedSource)) throw new Error('Full smoke creates all prerequisites and always runs the complete checklist. Use a standalone branch for partial verification.');
  const stage = prepareOnly ? 'booking' : until || 'reconcile';
  const allowed = mode === 'cancel' ? ['booking', 'request', 'seller-auth', 'seller-view', 'approve', 'reconcile']
    : ['booking', 'seller-auth', 'fulfillment', 'request', 'process', 'reconcile'];
  if (!allowed.includes(stage)) throw new Error('Unknown stage for this branch.');
  if (args.some(arg => /^--(config|project|no-deps|workers|fully-parallel|shard|repeat-each|retries|debug|ui)/.test(arg))) throw new Error('Smoke commands manage projects, dependencies, one worker, and zero retries.');
  const root = path.join(__dirname, '..');
  const dataDir = path.join(root, '.auth', 'smoke-checklist');
  const run = selected || randomBytes(4).toString('hex');
  if (!/^[a-f0-9]{8}$/.test(run)) throw new Error('Use an eight-character hexadecimal run ID.');
  const manifestFile = path.join(dataDir, `${run}.json`);
  const existingManifest = fs.existsSync(manifestFile);
  let manifest;
  if (fs.existsSync(manifestFile)) {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (mode === 'full' && !args.includes('--list')) throw new Error('Full smoke creates fresh records. Resume an existing cancellation/refund branch with its --run ID.');
    if (selectedSource && selectedSource !== manifest.sourceRun) throw new Error('Do not replace the source of an existing branch.');
  } else {
    const currentFile = path.join(root, '.auth', 'rental', 'current.json');
    const sourceRun = mode === 'full' ? run : selectedSource || (fs.existsSync(currentFile) ? JSON.parse(fs.readFileSync(currentFile, 'utf8')).run : null);
    if (!/^[a-f0-9]{8}$/.test(sourceRun || '')) throw new Error('Standalone branches require a completed original rental run; use --source-run <ID>.');
    const childRun = branch => createHash('sha256').update(`${run}:${branch}`).digest('hex').slice(0, 8);
    manifest = { run, sourceRun, cancelRun: childRun('cancel'), refundRun: childRun('refund') };
  }
  const childRun = branch => createHash('sha256').update(`${run}:${branch}`).digest('hex').slice(0, 8);
  if (manifest.run !== run || !/^[a-f0-9]{8}$/.test(manifest.sourceRun || '')
    || manifest.cancelRun !== childRun('cancel') || manifest.refundRun !== childRun('refund')) {
    throw new Error('Invalid smoke handoff. Preserve the original manifest and reconcile its run IDs before continuing.');
  }
  const listing = args.includes('--list');
  if (new Set([manifest.run, manifest.cancelRun, manifest.refundRun]).size !== 3) throw new Error('Smoke run IDs must be distinct. Choose a fresh run.');
  if (!listing && !existingManifest) {
    const usedRuns = mode === 'full' ? [run, manifest.cancelRun, manifest.refundRun] : [manifest[`${mode}Run`]];
    for (const id of usedRuns) {
      if (fs.existsSync(path.join(root, '.auth', 'rental', 'runs', id, 'buyer-account.json'))) throw new Error('This ID already belongs to an account attempt. Choose a fresh smoke run; do not overwrite existing accounts.');
    }
  }
  const lockFile = path.join(root, '.auth', 'rental', 'execution.lock');
  let lock;
  let server;
  let child;
  const stop = () => { if (child && !child.killed) child.kill('SIGTERM'); };
  try {
    if (!listing) {
      fs.mkdirSync(path.dirname(lockFile), { recursive: true });
      try { lock = fs.openSync(lockFile, 'wx'); } catch { throw new Error('Another rental/smoke command may be running. Reconcile a leftover rental execution lock before continuing.'); }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, run }));
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      server = await chromium.launchServer({ host: '127.0.0.1', headless: !args.includes('--headed') });
    }
    const env = { ...process.env, YORENT_RENTAL_RUN: run, YORENT_SMOKE_MODE: mode,
      YORENT_SMOKE_SELECTION: JSON.stringify(manifest), PLAYWRIGHT_NO_COPY_PROMPT: '1' };
    delete env.YORENT_EXECUTION_MODE;
    delete env.YORENT_BROWSER_WS;
    if (server) env.YORENT_BROWSER_WS = server.wsEndpoint();
    console.log(`Smoke run ${run}, mode ${mode}; source ${manifest.sourceRun}; cancel ${manifest.cancelRun}; refund ${manifest.refundRun}.`);
    const target = `smoke-${mode === 'full' ? 'refund' : mode}-${stage}`;
    const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child = spawn(process.execPath, [cli, 'test', '--config=playwright.smoke.config.js', `--project=${target}`, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 130)); });
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    if (server) await server.close();
    if (lock !== undefined) { fs.closeSync(lock); fs.rmSync(lockFile); }
  }
}
main().catch(error => { console.error(error.message.replace(/wss?:\/\/\S+/g, '[private browser endpoint]')); process.exitCode = 1; });
