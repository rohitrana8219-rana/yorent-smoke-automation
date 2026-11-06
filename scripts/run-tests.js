const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const root = path.join(__dirname, '..');
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const modules = {
  brand: ['module-admin', 'tests/admin/brands.spec.js'],
  category: ['module-admin', 'tests/admin/categories.spec.js'],
  'tax-structure': ['module-admin', 'tests/admin/tax-structure.spec.js'],
  shipping: ['module-admin', 'tests/modules/shipping.spec.js'],
  commission: ['module-admin', 'tests/modules/commission.spec.js'],
  'seller-registration': ['module-registration', 'tests/seller/registration.spec.js'],
  admin: ['module-admin'],
};

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (args.includes('--help') || !mode) {
    console.log('module <brand|category|tax-structure|shipping|commission|seller-registration|admin> [Playwright flags]');
    console.log('suite tax [Playwright flags]');
    console.log('workflow [--headed] [Playwright flags]: one Chromium process and one worker; isolated contexts.');
    return;
  }
  const env = { ...process.env };
  delete env.YORENT_BROWSER_WS;
  delete env.YORENT_EXECUTION_MODE;
  let testArgs;
  let extra;
  if (mode === 'module' || mode === 'suite') {
    const [target, ...flags] = args;
    const selection = mode === 'module' ? modules[target] : target === 'tax' ? ['suite-tax'] : null;
    if (!selection) throw new Error(`Unknown ${mode} target. Use --help to list supported targets.`);
    extra = flags;
    testArgs = ['--config=playwright.modules.config.js', `--project=${selection[0]}`, ...selection.slice(1)];
    env.YORENT_EXECUTION_MODE = 'modules';
  } else if (mode === 'workflow') {
    extra = args;
    if (extra.some(arg => /^--(workers|fully-parallel|shard)/.test(arg))) {
      throw new Error('The sequential workflow requires one worker without parallel or shard overrides.');
    }
    testArgs = ['--project=chromium-seller', '--workers=1'];
  } else {
    throw new Error('Choose module, suite, or workflow.');
  }
  if (extra.some(arg => /^--(config|project|no-deps)/.test(arg))) {
    throw new Error('This command manages project selection and dependencies. Pass filters such as --grep or --headed instead.');
  }
  let server;
  let child;
  const stop = () => { if (child && !child.killed) child.kill('SIGTERM'); };
  try {
    if (mode === 'workflow' && !extra.includes('--list')) {
      server = await chromium.launchServer({ host: '127.0.0.1', headless: !extra.includes('--headed') });
      env.YORENT_BROWSER_WS = server.wsEndpoint();
      console.log('Sequential workflow: one shared Chromium process; fresh test contexts and separate role states.');
    }
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child = spawn(process.execPath, [cli, 'test', ...testArgs, ...extra], {
      cwd: root, env, stdio: 'inherit', windowsHide: true,
    });
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code === null ? 130 : code));
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (server) {
      await server.close();
      console.log('Shared Chromium process closed.');
    }
  }
}

main().catch(error => {
  console.error(error.message.replace(/wss?:\/\/\S+/g, '[private browser endpoint]'));
  process.exitCode = 1;
});
