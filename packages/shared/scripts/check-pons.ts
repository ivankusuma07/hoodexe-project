/**
 * Kickoff check (docs/BRIEF.md §14 "Still open"): verifies the Pons V2 addresses and our hand-written
 * ABIs against chain 4663, and reports whether public launches are open.
 *
 *   pnpm --filter @hood/shared check:pons [wallet]
 */
import { createPublicClient, formatEther, http, parseAbiItem, parseEther, type Address } from 'viem';
import {
  NATIVE_PAIR,
  PONS_V2,
  PUBLIC_RPC_MAINNET,
  ponsCurveAbi,
  ponsFactoryAbi,
  ponsTokenAbi,
  quoteBuy,
  robinhoodChain,
} from '../src';

const rpc = process.env.RPC_URL || PUBLIC_RPC_MAINNET;
// The public RPC is rate-limited: batch calls and back off on 429s.
const client = createPublicClient({
  chain: robinhoodChain(rpc),
  transport: http(rpc, { batch: { batchSize: 20, wait: 20 }, retryCount: 6, retryDelay: 1_500 }),
});
const factory = { address: PONS_V2.launchFactory, abi: ponsFactoryAbi } as const;
const probe = (process.argv[2] as Address | undefined) ?? '0x000000000000000000000000000000000000dEaD';

async function main() {
  console.log(`RPC ${rpc}`);
  const [canLaunch, launchEnabled, launchFee, maxTax, snipeStart, snipeSecs, configCount, forwarder] = await Promise.all([
    client.readContract({ ...factory, functionName: 'canLaunch', args: [probe] }),
    client.readContract({ ...factory, functionName: 'launchEnabled' }),
    client.readContract({ ...factory, functionName: 'launchFee' }),
    client.readContract({ ...factory, functionName: 'maxCreatorTaxBps' }),
    client.readContract({ ...factory, functionName: 'snipeTaxStartBps' }),
    client.readContract({ ...factory, functionName: 'snipeTaxSeconds' }),
    client.readContract({ ...factory, functionName: 'launchConfigCount' }),
    client.readContract({ ...factory, functionName: 'launchForwarder' }),
  ]);
  console.log({
    canLaunch: `${canLaunch} (probe ${probe})`,
    launchEnabled,
    launchFee: `${formatEther(launchFee)} ETH`,
    maxCreatorTaxBps: maxTax,
    snipeTax: `${snipeStart} bps over ${snipeSecs}s`,
    launchConfigCount: configCount,
    launchForwarder: forwarder,
    forwarderIsRouter: forwarder.toLowerCase() === PONS_V2.launchAndBuy.toLowerCase(),
  });

  for (let id = 0n; id < configCount; id++) {
    const c = await client.readContract({ ...factory, functionName: 'getLaunchConfig', args: [id] });
    console.log(`config ${id}:`, {
      supply: formatEther(c.supply),
      curveFeeBps: c.curveFeeBps,
      phantomQuote: `${formatEther(c.phantomQuote)} ETH`,
      graduationThreshold: `${formatEther(c.graduationThreshold)} ETH`,
      poolFee: c.poolFee,
      tickSpacing: c.tickSpacing,
      enabled: c.enabled,
    });
  }

  // Most recent launch, found by walking back over the factory's TokenLaunched logs.
  const latest = await client.getBlockNumber();
  const event = parseAbiItem(
    'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
  );
  const STEP = 50_000n;
  let launched: Awaited<ReturnType<typeof client.getLogs<typeof event>>> = [];
  for (let to = latest, i = 0; i < 40 && launched.length === 0; i++, to -= STEP) {
    launched = await client.getLogs({ address: PONS_V2.launchFactory, event, fromBlock: to - STEP + 1n, toBlock: to });
  }
  const last = launched.at(-1);
  if (!last) {
    console.log('No TokenLaunched logs found in the scanned range.');
    return;
  }
  const { token, curve, deployer, pairToken } = last.args as { token: Address; curve: Address; deployer: Address; pairToken: Address };
  console.log('latest launch:', { block: last.blockNumber, token, curve, deployer, pairToken });

  const record = await client.readContract({ ...factory, functionName: 'getLaunchedToken', args: [token] });
  console.log('getLaunchedToken:', { phase: record.phase, creatorTaxBps: record.creatorTaxBps, exists: record.exists });

  const c = { address: curve, abi: ponsCurveAbi } as const;
  const [reserves, feeBps, sellable, ready, snipe, phantom] = await Promise.all([
    client.readContract({ ...c, functionName: 'getReserves' }),
    client.readContract({ ...c, functionName: 'feeBps' }),
    client.readContract({ ...c, functionName: 'sellableTokens' }),
    client.readContract({ ...c, functionName: 'readyToGraduate' }),
    client.readContract({ ...c, functionName: 'currentSnipeTaxBps', args: [probe] }).catch((e: Error) => `call failed: ${e.message.split('\n')[0]}`),
    client.readContract({ ...c, functionName: 'phantomQuote' }),
  ]);
  console.log('curve:', { reserves, feeBps, sellable, readyToGraduate: ready, currentSnipeTaxBps: snipe, phantomQuote: phantom });

  const info = await client.readContract({ address: token, abi: ponsTokenAbi, functionName: 'getTokenInfo' });
  console.log('getTokenInfo:', { deployer: info[0], logo: info[1].slice(0, 80), description: info[2].slice(0, 120) });

  // Quote port vs. the contract: simulate buy() with eth_call (balance overridden, nothing is sent).
  if (record.phase === 0 && pairToken === NATIVE_PAIR) {
    const creatorTaxBps = await client.readContract({ ...c, functionName: 'creatorTaxBps' });
    const state = { quoteReserve: reserves[0], tokenReserve: reserves[1], sellable, feeBps, creatorTaxBps };
    const buyer: Address = '0x00000000000000000000000000000000000b0b0b';
    for (const eth of ['0.001', '0.05', '1', '50']) {
      const quoteIn = parseEther(eth);
      const snipeBps = await client.readContract({ ...c, functionName: 'currentSnipeTaxBps', args: [buyer] });
      const quote = quoteBuy(state, quoteIn, snipeBps);
      const { result } = await client.simulateContract({
        ...c,
        functionName: 'buy',
        args: [quoteIn, 0n, buyer],
        value: quoteIn,
        account: buyer,
        stateOverride: [{ address: buyer, balance: parseEther('1000') }],
      });
      const match = quote?.tokensOut === result ? 'MATCH' : 'MISMATCH';
      console.log(`buy ${eth} ETH: contract ${result} · quote ${quote?.tokensOut} (snipe ${snipeBps} bps, clamped ${quote?.completesCurve}) → ${match}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
