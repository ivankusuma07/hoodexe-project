import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { PUBLIC_RPC_MAINNET, robinhoodChain } from '@hood/shared';
import { anvilDevWallet } from './devWallet';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || PUBLIC_RPC_MAINNET;
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const chain = robinhoodChain(rpcUrl);

// Local fork only (`pnpm fork`): the dev wallet needs an RPC that signs for it, so refuse anything else.
const devWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1' && /^http:\/\/(127\.0\.0\.1|localhost):/.test(rpcUrl);

// Without a Reown project id only wallets that don't need WalletConnect are offered.
const publicWallets = projectId
  ? [
      { groupName: 'Recommended', wallets: [metaMaskWallet, rabbyWallet, rainbowWallet, coinbaseWallet] },
      { groupName: 'Other', wallets: [walletConnectWallet, injectedWallet] },
    ]
  : [{ groupName: 'Installed', wallets: [injectedWallet, coinbaseWallet] }];
const walletList = devWallet ? [{ groupName: 'Local fork', wallets: [anvilDevWallet] }, ...publicWallets] : publicWallets;

const connectors = connectorsForWallets(walletList, {
  appName: 'hood.exe',
  appDescription: 'Launch coins backed by theorems on Robinhood Chain.',
  appUrl: 'https://hood.fun',
  projectId: projectId ?? 'walletconnect-disabled',
});

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors,
  transports: { [chain.id]: http(rpcUrl) },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
