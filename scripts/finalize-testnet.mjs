import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validate} from './configure-hub.mjs';

const configFile = process.argv[2];
if (!configFile) throw Error('Usage: npm run finalize:testnet -- path/to/new-hub-config.json');
const accountArg = process.argv.indexOf('--account');
const audit = fs.existsSync('deployment/testnet-audit.json') ? JSON.parse(fs.readFileSync('deployment/testnet-audit.json', 'utf8')) : {};
const account = accountArg >= 0 ? process.argv[accountArg + 1] : audit.account;
if (!account) throw Error('Provide --account <public address> or keep an audited account in deployment/testnet-audit.json');

const config = await validate(JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, '')), {requireBatch: true});
fs.writeFileSync('web/hub-deployment.json', JSON.stringify(config, null, 2) + '\n');
console.log('New batch-capable hub validated and written to web/hub-deployment.json');

function run(label, args) {
  try {
    execFileSync(process.execPath, args, {stdio: 'inherit'});
    console.log('PASS ' + label);
    return true;
  } catch (error) {
    console.error('BLOCKED ' + label + ': ' + (error.message || error));
    return false;
  }
}

run('verify explorer source', ['scripts/verify-hub.mjs']);
run('public RPC estimates', ['scripts/hub-benchmark.mjs', '--testnet', '--config', 'web/hub-deployment.json', '--account', account]);
run('new bytecode batch simulation', ['scripts/testnet-simulate.mjs', '--config', 'web/hub-deployment.json', '--account', account]);
run('submission readiness', ['scripts/submission-check.mjs']);

console.log('Next: run npm run build, review submission/readiness.json, commit the deployment config and evidence, then push main for GitHub Pages.');
