import { isAddressEqual, type Address } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { signMessage } from 'wagmi/actions';
import { ROBINHOOD_CHAIN_ID } from '@hood/shared';
import { currentSession, logout, siweNonce, verifySiwe } from './api';
import { wagmiConfig } from './wagmi';

/**
 * Makes sure the API session belongs to `address`, asking the wallet to sign in when it doesn't
 * (docs/BRIEF.md §10). A session for another wallet is replaced.
 */
export async function ensureSession(address: Address): Promise<void> {
  const wallet = await currentSession();
  if (wallet && isAddressEqual(wallet as Address, address)) return;
  if (wallet) await logout().catch(() => {});

  const nonce = await siweNonce();
  const message = createSiweMessage({
    domain: window.location.host,
    address,
    statement: 'Sign in to hood.exe. This does not send a transaction or cost gas.',
    uri: window.location.origin,
    version: '1',
    chainId: ROBINHOOD_CHAIN_ID,
    nonce,
    issuedAt: new Date(),
  });
  const signature = await signMessage(wagmiConfig, { account: address, message });
  await verifySiwe(message, signature);
}
