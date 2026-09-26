import { type LedgerWalletIdentity } from './createLedgerSuiteDevice';
import { type DiscoveredLedgerNetworkAccount } from './discoverLedgerAccounts';

export type DiscoveredLedgerWallet = {
    wallet: LedgerWalletIdentity;
    accounts: DiscoveredLedgerNetworkAccount[];
};
