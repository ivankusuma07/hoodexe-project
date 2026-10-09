/**
 * Local Robinhood Chain (4663) with the real Pons V2 contracts, for testing launches end to end.
 *
 *   pnpm fork              serve the saved snapshot on http://127.0.0.1:8545
 *   pnpm fork --refresh    re-fork mainnet first (new launch terms, pair tokens, …)
 *
 * The public RPC keeps state for only ~10 minutes of blocks, so a live `anvil --fork-url` breaks as soon
 * as its fork block ages out. Instead this forks once, warms every path the wizard touches (both launch
 * entry points, an ETH dev buy, a graduating dev buy, every pair asset), dumps the state, and serves the
 * dump with no upstream. Accounts that were never touched read as empty, which is exactly right for the
 * fresh token and curve addresses each launch creates.
 *
 * Needs Foundry's anvil: ANVIL=…, ~/.foundry/bin, or PATH.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createPublicClient, encodeFunctionData, erc20Abi, http, multicall3Abi, parseEther, toHex, type Address, type Hex } from 'viem';
import {
  LAUNCH_PAIRS,
  MULTICALL3,
  NATIVE_PAIR,
  PONS_V2,
  PUBLIC_RPC_MAINNET,
  ROBINHOOD_CHAIN_ID,
  buildDescription,
  buildTokenParams,
  planLaunch,
  ponsFactoryAbi,
  randomSalt,
  robinhoodChain,
} from '../src';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SNAPSHOT = join(ROOT, '.fork', 'robinhood-4663.json');
const PORT = Number(process.env.FORK_PORT ?? 8545);
const WARM_PORT = PORT + 1;
const UPSTREAM = process.env.RPC_URL || PUBLIC_RPC_MAINNET;

/** Anvil's default dev accounts (mnemonic "test test … junk"); unlocked on the local node. */
const DEV_ACCOUNTS: Address[] = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
];

function anvilPath(): string {
  if (process.env.ANVIL) return process.env.ANVIL;
  const local = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'anvil.exe' : 'anvil');
  return existsSync(local) ? local : 'anvil';
}

function startAnvil(args: string[], quiet: boolean): ChildProcess {
  const child = spawn(anvilPath(), [...args, '--chain-id', String(ROBINHOOD_CHAIN_ID)], { stdio: quiet ? 'ignore' : 'inherit' });
  child.on('error', (e) => {
    console.error(`Could not start anvil (${e.message}). Install Foundry or set ANVIL=/path/to/anvil.`);
    process.exit(1);
  });
  return child;
}

function client(port: number) {
  const url = `http://127.0.0.1:${port}`;
  return createPublicClient({ chain: robinhoodChain(url), transport: http(url, { retryCount: 0 }) });
}

async function waitFor(port: number) {
  const c = client(port);
  for (let i = 0; i < 120; i++) {
    try {
      await c.getChainId();
      return c;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`anvil did not come up on port ${port}`);
}

type Client = ReturnType<typeof client>;
const anvil = (c: Client, method: string, params: unknown[]) => c.request({ method, params } as never);

/** Clears any code mainnet attached to the well-known dev keys (EIP-7702 sweepers) and funds them. */
async function prepareDevAccounts(c: Client, { stablecoins = false } = {}) {
  const stable = LAUNCH_PAIRS.find((p) => p.kind === 'stable')!;
  for (const a of DEV_ACCOUNTS) {
    await anvil(c, 'anvil_setCode', [a, '0x']);
    await anvil(c, 'anvil_setBalance', [a, toHex(parseEther('10000'))]);
    if (stablecoins) await dealErc20(c, a, stable.address, 10_000n * 10n ** BigInt(stable.decimals));
  }
}

async function warm(c: Client) {
  const factory = { address: PONS_V2.launchFactory, abi: ponsFactoryAbi } as const;
  const creator = DEV_ACCOUNTS[0];
  const [launchFee, count] = await Promise.all([
    c.readContract({ ...factory, functionName: 'launchFee' }),
    c.readContract({ ...factory, functionName: 'launchConfigCount' }),
  ]);

  // Everything the frontend reads, run as real transactions through Multicall3 (wagmi batches reads
  // through it, so its code has to be in the snapshot too). Results of eth_call are never dumped.
  const hashes: Hex[] = [];
  const fn = (name: string) => ponsFactoryAbi.find((x) => x.type === 'function' && x.name === name)!;
  const reads: { target: Address; callData: Hex }[] = [
    ...(['launchFee', 'launchEnabled', 'maxCreatorTaxBps', 'snipeTaxStartBps', 'snipeTaxSeconds', 'launchConfigCount'] as const).map((name) => ({
      target: PONS_V2.launchFactory,
      callData: encodeFunctionData({ abi: [fn(name)], functionName: name }),
    })),
    ...DEV_ACCOUNTS.map((a) => ({ target: PONS_V2.launchFactory, callData: encodeFunctionData({ abi: ponsFactoryAbi, functionName: 'canLaunch', args: [a] }) })),
    ...Array.from({ length: Number(count) }, (_, id) => ({
      target: PONS_V2.launchFactory,
      callData: encodeFunctionData({ abi: ponsFactoryAbi, functionName: 'getLaunchConfig', args: [BigInt(id)] }),
    })),
    ...LAUNCH_PAIRS.flatMap((pair) => [
      { target: PONS_V2.launchFactory, callData: encodeFunctionData({ abi: ponsFactoryAbi, functionName: 'approvedPairTokens', args: [pair.address] }) },
      { target: PONS_V2.launchFactory, callData: encodeFunctionData({ abi: ponsFactoryAbi, functionName: 'pairTokenEconomics', args: [pair.address] }) },
      { target: PONS_V2.launchFactory, callData: encodeFunctionData({ abi: ponsFactoryAbi, functionName: 'previewLaunchEconomics', args: [0n, pair.address] }) },
      ...(pair.address === NATIVE_PAIR
        ? []
        : [
            { target: pair.address, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'decimals' }) },
            { target: pair.address, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'symbol' }) },
            { target: pair.address, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [creator] }) },
            { target: pair.address, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'allowance', args: [creator, PONS_V2.launchAndBuy] }) },
          ]),
    ]),
  ];
  // Prefetch in parallel first: eth_call fills anvil's upstream cache, so the transactions below run
  // from memory instead of fetching slot by slot while mining.
  for (let i = 0; i < reads.length; i += 24) {
    await Promise.all(reads.slice(i, i + 24).map((r) => c.call({ to: r.target, data: r.callData }).catch(() => null)));
  }
  for (let i = 0; i < reads.length; i += 100) {
    const chunk = reads.slice(i, i + 100);
    const hash = (await anvil(c, 'eth_sendTransaction', [
      {
        from: creator,
        to: MULTICALL3,
        gas: toHex(30_000_000),
        data: encodeFunctionData({ abi: multicall3Abi, functionName: 'aggregate3', args: [chunk.map((r) => ({ ...r, allowFailure: true }))] }),
      },
    ])) as Hex;
    const receipt = await c.waitForTransactionReceipt({ hash, timeout: 300_000 });
    if (receipt.status !== 'success') throw new Error('warm-up multicall reverted');
    hashes.push(hash);
  }
  console.log(`  warm: ${reads.length} frontend reads via Multicall3 → success`);

  // Launch paths, executed for real: a bare launch per pair kind, an ETH dev buy, a dev buy that fills
  // the curve, and an ERC-20 dev buy (approve the router, then launchAndBuy).
  const stable = LAUNCH_PAIRS.find((p) => p.kind === 'stable')!;
  const stableBuy = 10n * 10n ** BigInt(stable.decimals);
  const sends: [Address, bigint][] = [
    [NATIVE_PAIR, 0n],
    [NATIVE_PAIR, parseEther('0.05')],
    [NATIVE_PAIR, parseEther('10')],
    ...LAUNCH_PAIRS.filter((p) => p.kind !== 'native')
      .slice(0, 3)
      .map((p): [Address, bigint] => [p.address, 0n]),
  ];
  if (await dealErc20(c, creator, stable.address, stableBuy * 100n)) {
    const approve = (await anvil(c, 'eth_sendTransaction', [
      {
        from: creator,
        to: stable.address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PONS_V2.launchAndBuy, stableBuy] }),
      },
    ])) as Hex;
    await c.waitForTransactionReceipt({ hash: approve, timeout: 300_000 });
    hashes.push(approve);
    sends.push([stable.address, stableBuy]);
  } else {
    console.log(`  warm: could not fund ${stable.symbol}; skipping the ERC-20 dev buy`);
  }
  for (const [pairToken, quoteIn] of sends) {
    const expectedEconomics = await c.readContract({ ...factory, functionName: 'previewLaunchEconomics', args: [0n, pairToken] });
    const params = buildTokenParams({
      name: 'hood.exe warm-up',
      symbol: 'WARM',
      logo: 'ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
      description: buildDescription('$1 + 1 = 2$', null, 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'),
      socials: { twitter: '', telegram: '', website: 'https://hood.fun' },
      creatorFeeRecipient: creator,
      creatorTaxBps: 0,
      buybackEnabled: false,
      expectedEconomics,
      salt: randomSalt(),
    });
    const plan = planLaunch({ params, launchConfigId: 0n, pairToken, launchFee, quoteIn, minTokensOut: 0n, recipient: creator });
    const data =
      plan.kind === 'launchToken'
        ? encodeFunctionData({ abi: plan.request.abi, functionName: plan.request.functionName, args: plan.request.args })
        : encodeFunctionData({ abi: plan.request.abi, functionName: plan.request.functionName, args: plan.request.args });
    const hash = (await anvil(c, 'eth_sendTransaction', [
      { from: creator, to: plan.request.address, data, value: toHex(plan.request.value) },
    ])) as Hex;
    const receipt = await c.waitForTransactionReceipt({ hash, timeout: 300_000 });
    console.log(`  warm: ${plan.kind} pair ${pairToken.slice(0, 8)}… dev buy ${quoteIn} → ${receipt.status}`);
    if (receipt.status !== 'success') throw new Error('warm-up launch reverted');
    hashes.push(hash);
  }
  await pinTouched(c, hashes);
}

/** anvil_dealERC20 finds the token's balance slot itself; false when it can't. */
async function dealErc20(c: Client, to: Address, token: Address, amount: bigint) {
  try {
    await anvil(c, 'anvil_dealERC20', [to, token, toHex(amount)]);
    return (await c.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [to] })) === amount;
  } catch {
    return false;
  }
}

/**
 * Anvil's dump keeps only accounts a transaction wrote. Anything merely read (a proxy's implementation
 * behind DELEGATECALL, a beacon, a slot read but never written) stays in the upstream cache and is gone
 * from the snapshot, so a USDG call would hit an empty implementation. Every account and slot the
 * warm-up transactions read is rewritten with its current value, which commits it without changing it.
 */
async function pinTouched(c: Client, hashes: Hex[]) {
  const touched = new Map<Address, Set<Hex>>();
  for (const hash of hashes) {
    const pre = (await anvil(c, 'debug_traceTransaction', [hash, { tracer: 'prestateTracer' }])) as Record<Address, { storage?: Record<Hex, Hex> }>;
    for (const [address, account] of Object.entries(pre) as [Address, { storage?: Record<Hex, Hex> }][]) {
      const slots = touched.get(address) ?? new Set<Hex>();
      for (const slot of Object.keys(account.storage ?? {}) as Hex[]) slots.add(slot);
      touched.set(address, slots);
    }
  }
  let slotCount = 0;
  const entries = [...touched];
  for (let i = 0; i < entries.length; i += 16) {
    await Promise.all(
      entries.slice(i, i + 16).map(async ([address, slots]) => {
        const [code, balance] = await Promise.all([c.getCode({ address }), c.getBalance({ address })]);
        if (code && code !== '0x') await anvil(c, 'anvil_setCode', [address, code]);
        await anvil(c, 'anvil_setBalance', [address, toHex(balance)]);
        for (const slot of slots) {
          const value = await c.getStorageAt({ address, slot });
          await anvil(c, 'anvil_setStorageAt', [address, slot, value ?? '0x0']);
          slotCount++;
        }
      }),
    );
  }
  console.log(`  warm: pinned ${touched.size} accounts and ${slotCount} storage slots into the snapshot`);
}

async function snapshot() {
  console.log(`Forking ${UPSTREAM} …`);
  const fork = startAnvil(['--fork-url', UPSTREAM, '--port', String(WARM_PORT), '--silent'], true);
  try {
    const c = await waitFor(WARM_PORT);
    console.log(`Forked at block ${await c.getBlockNumber()}; warming the launch paths (the upstream keeps state ~10 min) …`);
    await prepareDevAccounts(c);
    await warm(c);
    // Plain fetch: the dump is larger than viem's 10 MB response cap.
    const res = await fetch(`http://127.0.0.1:${WARM_PORT}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_dumpState', params: [] }),
    });
    const hex = ((await res.json()) as { result: Hex }).result;
    const raw = Buffer.from(hex.slice(2), 'hex');
    const json = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
    mkdirSync(join(ROOT, '.fork'), { recursive: true });
    writeFileSync(SNAPSHOT, json);
    console.log(`Saved ${SNAPSHOT} (${(json.length / 1024).toFixed(0)} KB).`);
  } finally {
    fork.kill();
  }
}

async function portInUse(port: number) {
  try {
    await client(port).getChainId();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  for (const port of [PORT, WARM_PORT]) {
    if (await portInUse(port)) {
      console.error(`Port ${port} is already serving a chain (an old anvil?). Stop it first, or set FORK_PORT.`);
      process.exit(1);
    }
  }
  if (process.argv.includes('--refresh') || !existsSync(SNAPSHOT)) await snapshot();
  else console.log(`Using ${SNAPSHOT} from ${statSync(SNAPSHOT).mtime.toISOString()} (pnpm fork --refresh to re-fork).`);

  const node = startAnvil(['--load-state', SNAPSHOT, '--port', String(PORT), '--host', '127.0.0.1', '--silent'], false);
  const c = await waitFor(PORT);
  await prepareDevAccounts(c, { stablecoins: true });
  console.log(`
Robinhood Chain fork on http://127.0.0.1:${PORT} (chain ${ROBINHOOD_CHAIN_ID}, block ${await c.getBlockNumber()}), Pons V2 live.
Dev accounts (10,000 ETH and 10,000 USDG each, unlocked): ${DEV_ACCOUNTS.join(', ')}

  apps/web/.env.local  NEXT_PUBLIC_RPC_URL=http://127.0.0.1:${PORT}
                       NEXT_PUBLIC_DEV_WALLET=1
  apps/api/.env        RPC_URL_SERVER=http://127.0.0.1:${PORT}

Ctrl+C to stop. State is not saved; every run starts from the snapshot.`);
  const stop = () => {
    node.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  node.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
