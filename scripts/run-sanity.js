const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const args = process.argv.slice(2);
const index = args.indexOf('--source-run');
if (index < 0 || !/^[a-f0-9]{8}$/.test(args[index + 1] || '')) throw new Error('Provide --source-run <completed normal rental run ID>.');
const run = args.splice(index, 2)[1];
if (args.some(a => /^--(config|project|workers|retries|repeat-each|shard|fully-parallel)/.test(a))) throw new Error('Gap validation requires its configured role, one worker and zero retries.');
const dir = path.join('.auth','rental','runs',run);
const data = JSON.parse(fs.readFileSync(path.join(dir,'journey.json')));
if (data.run !== run || data.pending || !['admin','seller'].every(s => data.lines?.[s]?.status === 'Completed')) throw new Error('Source must be a fully completed normal rental with no pending intent.');
const lockFile = path.join('.auth','rental','execution.lock');
const lock = fs.openSync(lockFile,'wx');
fs.writeFileSync(lock, JSON.stringify({pid:process.pid,run,purpose:'sanity-gaps'}));
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')),'cli.js');
const child = spawn(process.execPath,[cli,'test','--config=playwright.sanity.config.js',...args],{
 stdio:'inherit',windowsHide:true,env:{...process.env,YORENT_SANITY_SOURCE_RUN:run},
});
const cleanup = () => {fs.closeSync(lock);fs.unlinkSync(lockFile);};
child.once('error',error=>{cleanup();console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{cleanup();process.exitCode=code ?? 1;});
