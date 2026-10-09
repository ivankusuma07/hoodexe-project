import {
  TransactionReceiptNotFoundError,
  createPublicClient,
  http,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { PONS_V2, PUBLIC_RPC_MAINNET, ponsFactoryAbi, ponsTokenAbi, robinhoodChain } from '@hood/shared';

export type LaunchOnChain = {
  token: Address;
  curve: Address;
  deployer: Address;
  pairToken: Address;
  blockNumber: bigint;
  description: string;
};

export interface ChainReader {
  /** EOA signatures and smart-contract wallets (ERC-1271 / ERC-6492). */
  verifySignature(address: Address, message: string, signature: Hex): Promise<boolean>;
  /** The Pons V2 launch in a mined transaction; 'pending' before it is mined, null when it isn't a launch. */
  launchFromTx(hash: Hash): Promise<LaunchOnChain | 'pending' | null>;
  /** Native ETH balance on 4663 (posting callouts needs a non-zero one, docs/BRIEF.md §10). */
  balance(address: Address): Promise<bigint>;
}

export function rpcChainReader(rpcUrl: string = PUBLIC_RPC_MAINNET): ChainReader {
  const client = createPublicClient({ chain: robinhoodChain(rpcUrl), transport: http(rpcUrl, { retryCount: 3 }) });
  return {
    verifySignature: (address, message, signature) => client.verifyMessage({ address, message, signature }),
    balance: (address) => client.getBalance({ address }),

    async launchFromTx(hash) {
      let receipt;
      try {
        receipt = await client.getTransactionReceipt({ hash });
      } catch (e) {
        if (e instanceof TransactionReceiptNotFoundError) return 'pending';
        throw e;
      }
      if (receipt.status !== 'success') return null;
      const factoryLogs = receipt.logs.filter((l) => isAddressEqual(l.address, PONS_V2.launchFactory));
      const [launched] = parseEventLogs({ abi: ponsFactoryAbi, eventName: 'TokenLaunched', logs: factoryLogs });
      if (!launched) return null;
      const { token, curve, deployer, pairToken } = launched.args;
      const description = await client.readContract({ address: token, abi: ponsTokenAbi, functionName: 'description' });
      return { token, curve, deployer, pairToken, blockNumber: receipt.blockNumber, description };
    },
  };
}
