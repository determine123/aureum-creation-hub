import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import solc from 'solc';
import {AbiCoder,Interface,formatEther,getAddress,isAddress,keccak256,toBeHex} from 'ethers';
import {publicProvider} from './public-provider.mjs';

// Read-only Monad testnet simulation of the exact new CreationHub bytecode.
// State overrides provide demo balances, allowances and creation rows. No
// transaction is signed or sent; the simulated address has no deployed code.
const arg = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const configPath = arg('--config') || 'web/hub-deployment.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const auditPath = 'deployment/testnet-audit.json';
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : {};
const account = getAddress(arg('--account') || audit.account);
if (!isAddress(config.token) || config.chainId !== 10143) throw Error('Provide a Monad testnet config with a token address');
if (!config.rpcUrl.startsWith('https://')) throw Error('Public RPC must use HTTPS');

const input = JSON.parse(fs.readFileSync('artifacts/standard-input.json', 'utf8'));
input.settings.outputSelection = {'*': {'*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences', 'storageLayout']}};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors?.some(e => e.severity === 'error')) throw Error(output.errors.map(e => e.formattedMessage).join('\n'));
const hubArtifact = output.contracts['contracts/CreationHub.sol'].CreationHub;
const tokenArtifact = output.contracts['contracts/DemoToken.sol'].DemoToken;
const abi = AbiCoder.defaultAbiCoder();
const hubInterface = new Interface(hubArtifact.abi);
const tokenInterface = new Interface(tokenArtifact.abi);

function patchImmutable(code, tokenAddress) {
  const replacement = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
  for (const ranges of Object.values(hubArtifact.evm.deployedBytecode.immutableReferences || {})) {
    for (const {start, length} of ranges) {
      if (length !== 32) throw Error('Unexpected immutable width');
      const index = 2 + start * 2;
      code = code.slice(0, index) + replacement + code.slice(index + length * 2);
    }
  }
  return code;
}

const runtime = patchImmutable('0x' + hubArtifact.evm.deployedBytecode.object, config.token);
const storage = hubArtifact.storageLayout.storage;
const field = label => storage.find(row => row.label === label);
const creationsSlot = BigInt(field('creations').slot);
const statusSlot = BigInt(field('_status').slot);
const arrayBase = BigInt(keccak256(abi.encode(['uint256'], [creationsSlot])));
const structType = hubArtifact.storageLayout.types[field('creations').type].base;
const members = hubArtifact.storageLayout.types[structType].members;
const structSlots = BigInt(Math.max(...members.map(row => Number(row.slot))) + 1);
const memberSlot = label => BigInt(members.find(row => row.label === label).slot);

const simulated = '0x00000000000000000000000000000000000A11CE';
const amount = 10n ** 18n;
const tokenBalanceSlot = keccak256(abi.encode(['address', 'uint256'], [account, 0]));
const allowanceInner = keccak256(abi.encode(['address', 'uint256'], [account, 1]));
const allowanceSlot = keccak256(abi.encode(['address', 'uint256'], [simulated, allowanceInner]));

function stateFor(count) {
  const stateDiff = {};
  stateDiff[toBeHex(statusSlot, 32)] = toBeHex(1, 32); // ReentrancyGuard.NOT_ENTERED
  stateDiff[toBeHex(creationsSlot, 32)] = toBeHex(BigInt(count), 32);
  for (let i = 0; i < count; i++) {
    const base = arrayBase + BigInt(i) * structSlots;
    const author = '0x' + (i + 0x1000).toString(16).padStart(40, '0');
    stateDiff[toBeHex(base + memberSlot('id'), 32)] = toBeHex(BigInt(i), 32);
    stateDiff[toBeHex(base + memberSlot('author'), 32)] = '0x' + author.slice(2).padStart(64, '0');
    stateDiff[toBeHex(base + memberSlot('archived'), 32)] = toBeHex(0, 32);
  }
  return {
    [simulated]: {code: runtime, stateDiff},
    [config.token]: {
      stateDiff: {
        [tokenBalanceSlot]: toBeHex(10n ** 30n, 32),
        [allowanceSlot]: toBeHex(10n ** 30n, 32)
      }
    }
  };
}

const provider = publicProvider(config.rpcUrl);
try {
  if ((await provider.getNetwork()).chainId !== 10143n) throw Error('RPC chain mismatch');
  if (await provider.getCode(config.token) === '0x') throw Error('Token has no bytecode');
  const fees = await provider.getFeeData();
  if (fees.gasPrice === null) throw Error('Missing gas price');
  const block = await provider.getBlock('latest');
  const estimate = async (label, tx, override = stateFor(3)) => {
    const gas = BigInt(await provider.send('eth_estimateGas', [tx, 'latest', override]));
    return {label, gas, gasLimit: gas + gas / 10n};
  };

  const threeRows = [];
  for (let i = 0; i < 3; i++) {
    threeRows.push(await estimate('support-' + i, {from: account, to: simulated, data: hubInterface.encodeFunctionData('support', [i, amount])}));
  }
  const batch3 = await estimate('supportBatch-3', {from: account, to: simulated, data: hubInterface.encodeFunctionData('supportBatch', [[0, 1, 2], [amount, amount, amount]])});
  const batch20State = stateFor(20);
  const ids20 = Array.from({length: 20}, (_, i) => i);
  const batch20 = await estimate('supportBatch-20', {from: account, to: simulated, data: hubInterface.encodeFunctionData('supportBatch', [ids20, ids20.map(() => amount)])}, batch20State);
  const publishes = [];
  for (const bytes of [100, 1000, 6000]) {
    publishes.push(await estimate('publish-' + bytes, {from: account, to: simulated, data: hubInterface.encodeFunctionData('publish', ['Benchmark', 'Monad RPC state-override simulation', 'x'.repeat(bytes), '', 0])}));
  }
  const approve = await estimate('approve', {from: account, to: config.token, data: tokenInterface.encodeFunctionData('approve', [simulated, 20n * amount])}, {});
  const deployData = '0x' + hubArtifact.evm.bytecode.object + abi.encode(['address'], [config.token]).slice(2);
  const deploy = await estimate('deploy-new-hub', {from: account, data: deployData}, {});

  const singleGas = threeRows.reduce((sum, row) => sum + row.gas, 0n);
  const saved = singleGas - batch3.gas;
  const savedPercent = Number(saved) * 100 / Number(singleGas);
  const rows = [...threeRows, batch3, batch20, ...publishes, approve, deploy].map(row => ({
    operation: row.label,
    estimatedGas: row.gas.toString(),
    gasLimitWith10Percent: row.gasLimit.toString(),
    estimatedFeeMon: formatEther(row.gasLimit * fees.gasPrice),
    kind: row.label === 'deploy-new-hub' ? 'creation-code estimate' : row.label.startsWith('publish') ? 'state-override eth_estimateGas' : 'state-override eth_estimateGas'
  }));
  const report = {
    recordedAt: new Date().toISOString(),
    scope: 'Monad testnet read-only eth_estimateGas simulation of the exact new CreationHub runtime; NO transaction sent and NO contract deployed at the simulated address',
    chainId: 10143,
    rpcUrl: config.rpcUrl,
    account,
    token: config.token,
    simulatedAddress: simulated,
    runtimeBytecodeHash: keccak256(runtime),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
    worktreeDirty: execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim().length > 0,
    latestBlock: {number: block.number, hash: block.hash},
    gasPriceWei: fees.gasPrice.toString(),
    rows,
    comparisons: {
      threeDifferentAuthors: {
        singleGas: singleGas.toString(),
        batchGas: batch3.gas.toString(),
        savedGas: saved.toString(),
        savedPercent,
        singleGasPerItem: (singleGas / 3n).toString(),
        batchGasPerItem: (batch3.gas / 3n).toString(),
        approvalExcluded: true,
        note: 'All three single estimates and the batch estimate start from the same overridden pre-state. Intrinsic gas is included in eth_estimateGas.'
      },
      twentyItemUpperBound: {
        batchGas: batch20.gas.toString(),
        gasLimitWith10Percent: batch20.gasLimit.toString(),
        note: 'Upper-bound estimate for the contract’s MAX_SUPPORT_BATCH. No single-transaction comparison is inferred.'
      }
    },
    caveats: [
      'State overrides synthesize token balances, allowances and creation rows; these are not real users or deployed storage.',
      'eth_estimateGas is not a receipt. Actual gas used, fee, inclusion and confirmation time require a real wallet transaction.',
      'The simulated address has no deployed code. A wallet deployment and explorer verification remain required.',
      'Monad charges by gas limit; fees here use estimate plus 10%, not a measured receipt.'
    ]
  };
  fs.mkdirSync('benchmarks', {recursive: true});
  fs.writeFileSync('benchmarks/monad-batch-simulation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.comparisons, null, 2));
  console.log('Saved benchmarks/monad-batch-simulation.json');
} finally {
  provider.destroy();
}
