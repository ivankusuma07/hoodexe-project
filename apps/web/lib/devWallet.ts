import type { Wallet } from '@rainbow-me/rainbowkit';
import { createConnector } from 'wagmi';
import { mock } from 'wagmi/connectors';

/** Anvil's first default account; `pnpm fork` funds it and the local node signs for it. */
const DEV_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#ff6b00"/><text x="14" y="19" font-family="Georgia" font-style="italic" font-size="14" fill="#fff" text-anchor="middle">dev</text></svg>',
  );

/**
 * Dev-only wallet for the local fork (NEXT_PUBLIC_DEV_WALLET=1): wagmi's mock connector, which forwards
 * signing and transactions to the RPC, where anvil holds the unlocked key. Never enabled in a real build.
 */
export const anvilDevWallet = (): Wallet => ({
  id: 'hood-anvil-dev',
  name: 'Anvil dev wallet',
  iconUrl: ICON,
  iconBackground: '#ff6b00',
  installed: true,
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...mock({ accounts: [DEV_ACCOUNT], features: { reconnect: true } })(config),
      ...walletDetails,
    })),
});
