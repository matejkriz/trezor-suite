import {
    type LedgerBitcoinService,
    type LedgerDevice,
    getLedgerWalletIdentity,
} from '@suite-common/ledger';
import { type AccountInfo } from '@trezor/connect';
import { type Bip43Path } from '@trezor/crypto-utils';

import { type LedgerWalletIdentity } from 'src/support/ledger/createLedgerSuiteDevice';

const MAX_ACCOUNTS = 10;

type GetAccountInfoResult =
    { success: true; payload: AccountInfo } | { success: false; error: { message: string } };

type DiscoverLedgerBitcoinWalletDeps = {
    ledgerBitcoinService: Pick<LedgerBitcoinService, 'connect' | 'getAccount' | 'getDeviceInfo'>;
    getAccountInfo: (descriptor: string) => Promise<GetAccountInfoResult>;
};

type DiscoveredLedgerAccount = {
    index: number;
    path: Bip43Path;
    accountInfo: AccountInfo;
    visible: boolean;
};

export type DiscoveredLedgerBitcoinWallet = {
    wallet: LedgerWalletIdentity;
    accounts: DiscoveredLedgerAccount[];
};

export const discoverLedgerBitcoinWallet = async (
    deps: DiscoverLedgerBitcoinWalletDeps,
    device: LedgerDevice,
): Promise<DiscoveredLedgerBitcoinWallet> => {
    await deps.ledgerBitcoinService.connect(device);

    const accounts: DiscoveredLedgerAccount[] = [];
    let wallet: LedgerWalletIdentity | undefined;

    for (let index = 0; index < MAX_ACCOUNTS; index++) {
        const ledgerAccount = await deps.ledgerBitcoinService.getAccount(index);
        const signerPath = `84'/0'/${index}'` as const;
        if (ledgerAccount.path !== signerPath) {
            throw new Error('Ledger returned an unexpected Bitcoin account path');
        }
        const path = `m/${signerPath}` as const;

        const response = await deps.getAccountInfo(ledgerAccount.descriptor);
        if (!response.success) throw new Error(response.error.message);
        if (response.payload.descriptor !== ledgerAccount.descriptor) {
            throw new Error('Bitcoin backend returned a different account descriptor');
        }

        if (!wallet) {
            const id = getLedgerWalletIdentity(ledgerAccount.descriptor);
            const deviceInfo = deps.ledgerBitcoinService.getDeviceInfo();
            wallet = {
                id,
                label: deviceInfo?.name || device.name || 'Ledger',
                staticSessionId: `${id}@ledger:0`,
                deviceInfo,
            };
        }

        accounts.push({
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
