import { deviceActions } from '@suite-common/device';
import { accountsActions } from '@suite-common/wallet-core';
import { type AccountInfo } from '@trezor/connect';

import { addDiscoveredLedgerBitcoinWallet } from './addDiscoveredLedgerBitcoinWallet';

describe('addDiscoveredLedgerBitcoinWallet', () => {
    it('adds a selected Ledger wallet and its Bitcoin account to Suite', () => {
        const dispatch = jest.fn();
        const accountInfo = {
            descriptor: 'zpubaccount',
            empty: true,
            balance: '0',
            availableBalance: '0',
            history: { total: 0, unconfirmed: 0 },
        } as AccountInfo;
        const wallet = {
            id: 'ledgerwallet',
            provider: 'ledger' as const,
            label: 'Ledger Flex',
            staticSessionId: 'ledgerwallet@ledger:0' as const,
            connected: true,
        };

        addDiscoveredLedgerBitcoinWallet(dispatch, {
            wallet,
            accounts: [{ index: 0, path: "m/84'/0'/0'", accountInfo, visible: true }],
        });

        expect(dispatch).toHaveBeenCalledWith(deviceActions.connectExternalWallet(wallet));
        expect(dispatch.mock.calls[1]?.[0]).toMatchObject({
            type: accountsActions.createAccount.type,
            payload: {
                account: {
                    deviceState: wallet.staticSessionId,
                    symbol: 'btc',
                    index: 0,
                    accountType: 'normal',
                    path: "m/84'/0'/0'",
                    descriptor: accountInfo.descriptor,
                    visible: true,
                },
            },
        });
    });
});
