'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './Button';
import { WalletIcon } from './Icons';

/** XP-styled wallet button. RainbowKit supplies the modals; we only draw the button. */
export function ConnectWallet({ large }: { large?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => {
        if (!mounted) {
          return (
            <Button variant="success" large={large} disabled aria-hidden>
              <WalletIcon size={16} /> Connect Wallet
            </Button>
          );
        }
        if (!account) {
          return (
            <Button variant="success" large={large} onClick={openConnectModal}>
              <WalletIcon size={16} /> Connect Wallet
            </Button>
          );
        }
        if (chain?.unsupported) {
          return (
            <Button variant="danger" large={large} onClick={openChainModal}>
              Switch to Robinhood Chain
            </Button>
          );
        }
        return (
          <Button large={large} onClick={openAccountModal}>
            <WalletIcon size={16} /> {account.displayName}
            {account.displayBalance ? ` · ${account.displayBalance}` : ''}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
