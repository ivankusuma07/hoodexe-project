/**
 * Pons V2 ABIs, written from the verified sources in ponsdotdev/pons-labs (contractsV2/src/v2) and the
 * Pons V2 docs (router, snipe tax). The published curve source predates the deployed snipe tax, so
 * every entry here is checked against chain 4663 by `pnpm --filter @hood/shared check:pons`.
 */

import type { AbiParameter } from 'viem';

const socials = {
  type: 'tuple',
  components: [
    { name: 'twitter', type: 'string' },
    { name: 'telegram', type: 'string' },
    { name: 'discord', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'farcaster', type: 'string' },
  ],
} as const;

const tokenParams = {
  name: 'params',
  type: 'tuple',
  components: [
    { name: 'name', type: 'string' },
    { name: 'symbol', type: 'string' },
    { name: 'logo', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'socials', ...socials },
    { name: 'creatorFeeRecipient', type: 'address' },
    { name: 'creatorTaxBps', type: 'uint16' },
    { name: 'buybackEnabled', type: 'bool' },
    { name: 'expectedEconomics', type: 'bytes32' },
    { name: 'salt', type: 'bytes32' },
  ],
} as const;

const launchedToken = {
  type: 'tuple',
  components: [
    { name: 'token', type: 'address' },
    { name: 'curve', type: 'address' },
    { name: 'deployer', type: 'address' },
    { name: 'creatorFeeRecipient', type: 'address' },
    { name: 'pairToken', type: 'address' },
    { name: 'graduationThreshold', type: 'uint256' },
    { name: 'poolFee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'creatorTaxBps', type: 'uint16' },
    { name: 'buybackEnabled', type: 'bool' },
    { name: 'phase', type: 'uint8' },
    { name: 'sweptQuote', type: 'uint256' },
    { name: 'sweptTokens', type: 'uint256' },
    { name: 'sweptAt', type: 'uint256' },
    { name: 'exists', type: 'bool' },
  ],
} as const;

const view = <
  const N extends string,
  const O extends readonly AbiParameter[],
  const I extends readonly AbiParameter[] = readonly [],
>(
  name: N,
  outputs: O,
  inputs?: I,
) => ({ type: 'function', name, stateMutability: 'view', inputs: (inputs ?? []) as I, outputs }) as const;

export const ponsFactoryAbi = [
  { type: 'function', name: 'canLaunch', stateMutability: 'view', inputs: [{ name: 'launcher', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'launchEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'launchFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxCreatorTaxBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxStartBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxSeconds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'launchForwarder', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'launchConfigCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'getLaunchConfig',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'supply', type: 'uint256' },
          { name: 'curveFeeBps', type: 'uint256' },
          { name: 'phantomQuote', type: 'uint256' },
          { name: 'graduationThreshold', type: 'uint256' },
          { name: 'poolFee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
  { type: 'function', name: 'getLaunchedToken', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [launchedToken] },
  { type: 'function', name: 'approvedPairTokens', stateMutability: 'view', inputs: [{ name: 'pairToken', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'pairTokenEconomics',
    stateMutability: 'view',
    inputs: [{ name: 'pairToken', type: 'address' }],
    outputs: [
      { name: 'phantomQuote', type: 'uint256' },
      { name: 'graduationThreshold', type: 'uint256' },
      { name: 'decimals', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'previewLaunchEconomics',
    stateMutability: 'view',
    inputs: [
      { name: 'launchConfigId', type: 'uint256' },
      { name: 'pairToken', type: 'address' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'launchToken',
    stateMutability: 'payable',
    inputs: [tokenParams, { name: 'launchConfigId', type: 'uint256' }, { name: 'pairToken', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'launchToken',
    stateMutability: 'payable',
    inputs: [
      tokenParams,
      { name: 'launchConfigId', type: 'uint256' },
      { name: 'pairToken', type: 'address' },
      { name: 'snipeTaxExemptions', type: 'address[]' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'TokenLaunched',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'deployer', type: 'address', indexed: true },
      { name: 'pairToken', type: 'address', indexed: false },
      { name: 'launchConfigId', type: 'uint256', indexed: false },
      { name: 'graduationThreshold', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LaunchSwept',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'quoteOut', type: 'uint256', indexed: false },
      { name: 'tokenOut', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PoolGraduated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'positionId', type: 'uint256', indexed: false },
      { name: 'tokenAmount', type: 'uint256', indexed: false },
      { name: 'pairTokenAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PairTokenApprovalUpdated',
    inputs: [
      { name: 'pairToken', type: 'address', indexed: true },
      { name: 'approved', type: 'bool', indexed: false },
    ],
  },
  { type: 'error', name: 'NotWhitelisted', inputs: [] },
  { type: 'error', name: 'LaunchFeeNotPaid', inputs: [] },
  { type: 'error', name: 'InvalidTokenParams', inputs: [] },
  { type: 'error', name: 'CreatorTaxTooHigh', inputs: [] },
  { type: 'error', name: 'CombinedFeeTooHigh', inputs: [] },
  { type: 'error', name: 'PairTokenNotApproved', inputs: [] },
  { type: 'error', name: 'LaunchConfigDisabled', inputs: [] },
  { type: 'error', name: 'InvalidLaunchConfigId', inputs: [] },
  { type: 'error', name: 'ExemptionListTooLong', inputs: [] },
  {
    type: 'error',
    name: 'LaunchEconomicsMismatch',
    inputs: [
      { name: 'expected', type: 'bytes32' },
      { name: 'actual', type: 'bytes32' },
    ],
  },
] as const;

export const ponsRouterAbi = [
  {
    type: 'function',
    name: 'launchAndBuy',
    stateMutability: 'payable',
    inputs: [
      tokenParams,
      { name: 'launchConfigId', type: 'uint256' },
      { name: 'pairToken', type: 'address' },
      { name: 'quoteIn', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'snipeTaxExemptions', type: 'address[]' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
      { name: 'tokensOut', type: 'uint256' },
    ],
  },
] as const;

export const ponsCurveAbi = [
  view('token', [{ type: 'address' }]),
  view('pairToken', [{ type: 'address' }]),
  view('isNativeQuote', [{ type: 'bool' }]),
  view('phantomQuote', [{ type: 'uint256' }]),
  view('feeBps', [{ type: 'uint256' }]),
  view('creatorTaxBps', [{ type: 'uint256' }]),
  view('graduationThreshold', [{ type: 'uint256' }]),
  view('graduated', [{ type: 'bool' }]),
  view('readyToGraduate', [{ type: 'bool' }]),
  view('sellableTokens', [{ type: 'uint256' }]),
  view('reservedTokens', [{ type: 'uint256' }]),
  view('realQuoteReserve', [{ type: 'uint256' }]),
  view('getReserves', [
    { name: 'quoteReserve', type: 'uint256' },
    { name: 'tokenReserve', type: 'uint256' },
  ]),
  view('currentSnipeTaxBps', [{ type: 'uint256' }], [{ name: 'recipient', type: 'address' }]),
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [
      { name: 'quoteIn', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokensIn', type: 'uint256' },
      { name: 'minQuoteOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'quoteOut', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'CurveBuy',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'quoteIn', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'tax', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CurveSell',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'tokensIn', type: 'uint256', indexed: false },
      { name: 'quoteOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'tax', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CurveBuyRefunded',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'refund', type: 'uint256', indexed: false },
    ],
  },
  { type: 'error', name: 'CurveGraduated', inputs: [] },
  {
    type: 'error',
    name: 'SlippageExceeded',
    inputs: [
      { name: 'actual', type: 'uint256' },
      { name: 'minimum', type: 'uint256' },
    ],
  },
] as const;

export const ponsTokenAbi = [
  view('logo', [{ type: 'string' }]),
  view('description', [{ type: 'string' }]),
  view('deployer', [{ type: 'address' }]),
  view('curve', [{ type: 'address' }]),
  view('getTokenInfo', [
    { name: 'tokenDeployer', type: 'address' },
    { name: 'tokenLogo', type: 'string' },
    { name: 'tokenDescription', type: 'string' },
    { name: 'tokenSocials', ...socials },
  ]),
] as const;

/** Byte caps enforced by PonsV2LaunchDeployer. */
export const PONS_METADATA_CAPS = {
  name: 64,
  symbol: 16,
  logo: 512,
  description: 2048,
  social: 256,
} as const;

export const PONS_MAX_SNIPE_TAX_EXEMPTIONS = 32;
