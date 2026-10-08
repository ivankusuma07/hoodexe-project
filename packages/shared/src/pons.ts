import type { Address } from 'viem';

/** Pons V2 contracts on Robinhood Chain (4663), from the Pons V2 docs contracts table. */
export const PONS_V2 = {
  launchFactory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  launchAndBuy: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
  memeHook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  feeEscrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  buybackVault: '0x42df2a798f82289E177311362e8f5ccC45c1219c',
  launchLocker: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952',
  launchDeployer: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42',
  graduationExecutor: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046',
  graduationGuard: '0xf5695117b99B6f6401e67d4195BD653628176C6C',
  uniswapV4PoolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
} as const satisfies Record<string, Address>;

/** Retired; no new launches. V1 tokens are shown read-only. */
export const PONS_V1_FACTORY: Address = '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB';

export const PONS_TOTAL_SUPPLY = 1_000_000_000n;

/** `getLaunchedToken().phase` — the only source of truth for a token's phase. */
export enum LaunchPhase {
  Curve = 0,
  Swept = 1,
  Pool = 2,
  Rescued = 3,
}
