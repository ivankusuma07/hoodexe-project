'use client';

import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type Address } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { NATIVE_PAIR, PONS_V2, findPair, ponsFactoryAbi } from '@hood/shared';

/** Pons has one launch config on 4663 (9 Oct 2026); the wizard refuses to launch if it is ever disabled. */
export const LAUNCH_CONFIG_ID = 0n;

const factory = { address: PONS_V2.launchFactory, abi: ponsFactoryAbi } as const;

export type LaunchTerms = {
  launchFee: bigint;
  maxCreatorTaxBps: number;
  curveFeeBps: bigint;
  supply: bigint;
  /** In pair-token units. */
  phantomQuote: bigint;
  graduationThreshold: bigint;
  decimals: number;
  /** previewLaunchEconomics: pinned into TokenParams so a re-peg reverts the launch instead of repricing it. */
  economics: `0x${string}`;
  configEnabled: boolean;
  pairApproved: boolean;
};

/** Everything the wizard shows about a launch's economics, read live from the factory. */
export function useLaunchTerms(pairToken: Address) {
  const native = pairToken === NATIVE_PAIR;
  const q = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...factory, functionName: 'launchFee' },
      { ...factory, functionName: 'maxCreatorTaxBps' },
      { ...factory, functionName: 'getLaunchConfig', args: [LAUNCH_CONFIG_ID] },
      { ...factory, functionName: 'previewLaunchEconomics', args: [LAUNCH_CONFIG_ID, pairToken] },
      { ...factory, functionName: 'pairTokenEconomics', args: [pairToken] },
      { ...factory, functionName: 'approvedPairTokens', args: [pairToken] },
    ],
    query: { staleTime: 60_000 },
  });

  let terms: LaunchTerms | undefined;
  if (q.data) {
    const [launchFee, maxTax, config, economics, pairEcon, approved] = q.data;
    terms = {
      launchFee,
      maxCreatorTaxBps: Number(maxTax),
      curveFeeBps: config.curveFeeBps,
      supply: config.supply,
      phantomQuote: native ? config.phantomQuote : pairEcon[0],
      graduationThreshold: native ? config.graduationThreshold : pairEcon[1],
      decimals: native ? 18 : pairEcon[2],
      economics,
      configEnabled: config.enabled,
      pairApproved: native || approved,
    };
  }
  return { terms, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

/** factory.canLaunch: false while Pons launches are invite-only. Undefined until a wallet is connected. */
export function useCanLaunch(address: Address | undefined) {
  const q = useReadContract({ ...factory, functionName: 'canLaunch', args: address ? [address] : undefined, query: { enabled: !!address } });
  return q.data;
}

export const pairSymbol = (pairToken: Address) => findPair(pairToken)?.symbol ?? 'tokens';

const REVERT_MESSAGES: Record<string, string> = {
  NotWhitelisted: 'Pons launches are invite-only right now, and this wallet is not on the list.',
  LaunchFeeNotPaid: 'The Pons launch fee changed. Go back to the review page to read the new fee.',
  InvalidTokenParams: 'Pons rejected the token name or ticker.',
  CreatorTaxTooHigh: 'The creator tax is above what Pons currently allows.',
  CombinedFeeTooHigh: 'The trade fee plus creator tax is above what Pons allows.',
  PairTokenNotApproved: 'Pons no longer accepts this pair asset. Pick another one.',
  LaunchConfigDisabled: 'Pons has paused new launches on this configuration.',
  InvalidLaunchConfigId: 'Pons has paused new launches on this configuration.',
  LaunchEconomicsMismatch: 'Pons changed its launch terms after you reviewed them. Go back and review the new terms.',
  SlippageExceeded: 'The price moved past your slippage limit before the dev buy filled.',
  InsufficientAllowance: 'The router is not approved to spend your dev buy.',
  ZeroAmount: 'The dev buy amount is zero.',
};

/** A sentence for the XP error dialog, from a wagmi/viem error or anything else thrown in the flow. */
export function launchErrorMessage(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return 'You cancelled the request in your wallet.';
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && REVERT_MESSAGES[name]) return REVERT_MESSAGES[name];
      return `The launch would fail on-chain${name ? ` (${name})` : ''}.`;
    }
    if (/insufficient funds/i.test(e.message)) return 'This wallet does not have enough ETH for the launch fee, dev buy and gas.';
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
