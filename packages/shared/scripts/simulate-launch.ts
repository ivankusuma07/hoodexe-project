/**
 * Dry-runs the wizard's launch transactions against chain 4663 with eth_call (balance overridden, nothing
 * is sent): launchToken without a dev buy, launchAndBuy with ETH dev buys, and checks that the pre-launch
 * quote equals the router's fill. Stands in for the Anvil fork until Foundry is part of the toolchain.
 *
 *   pnpm --filter @hood/shared simulate:launch
 */
import { createPublicClient, formatEther, http, parseEther, type Address } from 'viem';
import {
  NATIVE_PAIR,
  PONS_V2,
  PUBLIC_RPC_MAINNET,
  buildDescription,
  buildTokenParams,
  freshCurveState,
  planLaunch,
  ponsFactoryAbi,
  quoteBuy,
  randomSalt,
  robinhoodChain,
  withSlippage,
} from '../src';

const rpc = process.env.RPC_URL || PUBLIC_RPC_MAINNET;
const client = createPublicClient({
  chain: robinhoodChain(rpc),
  transport: http(rpc, { batch: { batchSize: 20, wait: 20 }, retryCount: 6, retryDelay: 1_500 }),
});
const factory = { address: PONS_V2.launchFactory, abi: ponsFactoryAbi } as const;
const creator: Address = '0x00000000000000000000000000000000000c0dE5';
const CONFIG = 0n;
const CREATOR_TAX_BPS = 150;

let failures = 0;

async function main() {
  const [launchFee, config, economics] = await Promise.all([
    client.readContract({ ...factory, functionName: 'launchFee' }),
    client.readContract({ ...factory, functionName: 'getLaunchConfig', args: [CONFIG] }),
    client.readContract({ ...factory, functionName: 'previewLaunchEconomics', args: [CONFIG, NATIVE_PAIR] }),
  ]);
  console.log(`launchFee ${formatEther(launchFee)} ETH · config ${CONFIG} enabled ${config.enabled}`);

  const state = freshCurveState(config.supply, config.phantomQuote, config.graduationThreshold, config.curveFeeBps, BigInt(CREATOR_TAX_BPS));

  for (const eth of ['0', '0.05', '1', '10']) {
    const quoteIn = parseEther(eth);
    const quote = quoteBuy(state, quoteIn);
    const params = buildTokenParams({
      name: 'hood.exe simulation',
      symbol: 'HOODSIM',
      logo: 'ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
      description: buildDescription('e^{i\\pi} + 1 = 0', 91, 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'),
      socials: { twitter: '@hoodexe', telegram: '', website: 'https://hood.fun' },
      creatorFeeRecipient: creator,
      creatorTaxBps: CREATOR_TAX_BPS,
      buybackEnabled: false,
      expectedEconomics: economics,
      salt: randomSalt(),
    });
    const plan = planLaunch({
      params,
      launchConfigId: CONFIG,
      pairToken: NATIVE_PAIR,
      launchFee,
      quoteIn,
      minTokensOut: quote ? withSlippage(quote.tokensOut, 500n) : 0n,
      recipient: creator,
    });
    const sim = { account: creator, stateOverride: [{ address: creator, balance: parseEther('1000') }] };
    try {
      if (plan.kind === 'launchToken') {
        const { result } = await client.simulateContract({ ...plan.request, ...sim });
        console.log(`launchToken, no dev buy → token ${result[0]} · OK`);
      } else {
        const { result } = await client.simulateContract({ ...plan.request, ...sim });
        const filled = result[2];
        const match = filled === quote?.tokensOut;
        if (!match) failures++;
        console.log(
          `launchAndBuy ${eth} ETH → token ${result[0]} · filled ${filled} · quote ${quote?.tokensOut} (clamped ${quote?.completesCurve}) → ${match ? 'MATCH' : 'MISMATCH'}`,
        );
      }
    } catch (e) {
      failures++;
      console.log(`${plan.kind} dev buy ${eth} ETH → FAILED: ${(e as Error).message.split('\n').slice(0, 3).join(' | ')}`);
    }
  }
  if (failures) {
    console.error(`${failures} simulation(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
