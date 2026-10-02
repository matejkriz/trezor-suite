import { type LedgerBitcoinService, getLedgerWalletIdentity } from '@suite-common/ledger';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type AccountInfo } from '@trezor/connect';

import { type LedgerWalletIdentity } from './createLedgerSuiteDevice';
import { type DiscoveredLedgerNetworkAccount } from './discoverLedgerAccounts';
import { type DiscoveredLedgerWallet } from './ledgerWalletTypes';

const MAX_ACCOUNTS = 10;

type GetAccountInfoResult =
    { success: true; payload: AccountInfo } | { success: false; error: { message: string } };

export type DiscoverLedgerBitcoinWalletDeps = {
    ledgerBitcoinService: Pick<
        LedgerBitcoinService,
        'getAccount' | 'getDeviceInfo' | 'isConnectionOwner'
    >;
    getAccountInfo: (descriptor: string) => Promise<GetAccountInfoResult>;
};

type DiscoverLedgerBitcoinWalletOptions = {
    signal?: AbortSignal;
    owner?: string;
};

export const discoverLedgerBitcoinWallet = async (
    deps: DiscoverLedgerBitcoinWalletDeps,
    options: DiscoverLedgerBitcoinWalletOptions = {},
): Promise<DiscoveredLedgerWallet> => {
    const ensureNotAborted = () => {
        if (options.signal?.aborted) throw new Error('Ledger connection canceled');
    };
    const ensureCurrentConnection = () => {
        ensureNotAborted();
        if (options.owner && !deps.ledgerBitcoinService.isConnectionOwner(options.owner)) {
            throw new Error('Ledger connection canceled');
        }
    };

    ensureCurrentConnection();

    const accounts: DiscoveredLedgerNetworkAccount[] = [];
    let wallet: LedgerWalletIdentity | undefined;

    for (let index = 0; index < MAX_ACCOUNTS; index++) {
        const ledgerAccount = await deps.ledgerBitcoinService.getAccount(index);
        ensureCurrentConnection();
        const signerPath = `84'/0'/${index}'` as const;
        if (ledgerAccount.path !== signerPath) {
            throw new Error('Ledger returned an unexpected Bitcoin account path');
        }
        const path = `m/${signerPath}` as const;

        const response = await deps.getAccountInfo(ledgerAccount.descriptor);
        ensureCurrentConnection();
        if (!response.success) throw new Error(response.error.message);
        if (response.payload.descriptor !== ledgerAccount.descriptor) {
            throw new Error('Bitcoin backend returned a different account descriptor');
        }

        if (!wallet) {
            const id = getLedgerWalletIdentity(ledgerAccount.descriptor);
            const deviceInfo = deps.ledgerBitcoinService.getDeviceInfo();
            wallet = {
                id,
                label: deviceInfo?.name || 'Ledger',
                staticSessionId: `${id}@ledger:0`,
                sessionId: options.owner,
                deviceInfo,
            };
        }

        accounts.push({
            symbol: asNetworkSymbol('btc'),
            accountType: 'normal',
            index,
            path,
            accountInfo: response.payload,
            visible: index === 0 || !response.payload.empty,
        });

        if (response.payload.empty) break;
    }

    if (!wallet) throw new Error('No Bitcoin account was found on Ledger');

    return { wallet, accounts };
};
