import { type LedgerBitcoinService, getLedgerWalletIdentity } from '@suite-common/ledger';

import {
    type DiscoverLedgerAccountsDeps,
    type DiscoverLedgerAccountsOptions,
    discoverLedgerAccounts,
} from './discoverLedgerAccounts';
import { type DiscoveredLedgerWallet } from './ledgerWalletTypes';

export type DiscoverLedgerWalletWithAccountsAppDeps = {
    ledgerBitcoinService: Pick<
        LedgerBitcoinService,
        'openAccountsDiscovery' | 'getDeviceInfo' | 'isConnectionOwner'
    >;
    getAccountInfo: DiscoverLedgerAccountsDeps['getAccountInfo'];
};

type DiscoverLedgerWalletWithAccountsAppOptions = DiscoverLedgerAccountsOptions & {
    owner?: string;
};

export const discoverLedgerWalletWithAccountsApp = async (
    deps: DiscoverLedgerWalletWithAccountsAppDeps,
    options: DiscoverLedgerWalletWithAccountsAppOptions,
): Promise<DiscoveredLedgerWallet> => {
    const isCurrentConnection = () =>
        !options.owner || deps.ledgerBitcoinService.isConnectionOwner(options.owner);
    const ensureCurrentConnection = () => {
        if (options.signal?.aborted || !isCurrentConnection())
            throw new Error('Ledger connection canceled');
    };
    ensureCurrentConnection();
    const accountsDiscoveryService = await deps.ledgerBitcoinService.openAccountsDiscovery();
    ensureCurrentConnection();
    const discovered = await discoverLedgerAccounts(
        {
            accountsDiscoveryService,
            getAccountInfo: deps.getAccountInfo,
            isCurrentConnection,
        },
        options,
    );
    ensureCurrentConnection();
    if (discovered.accounts.length === 0) throw new Error('No Ledger accounts could be discovered');

    const id = getLedgerWalletIdentity(discovered.baseDescriptor);
    const deviceInfo = deps.ledgerBitcoinService.getDeviceInfo();

    return {
        wallet: {
            id,
            label: deviceInfo?.name || 'Ledger',
            staticSessionId: `${id}@ledger:0`,
            sessionId: options.owner,
            deviceInfo,
            supportedNetworks: discovered.availableNetworks,
            accountsDiscoveryAppVersion: discovered.appVersion,
        },
        accounts: discovered.accounts,
        failedNetworks: discovered.failedNetworks,
    };
};
