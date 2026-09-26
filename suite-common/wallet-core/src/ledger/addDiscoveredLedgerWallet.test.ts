import { deviceActions } from '@suite-common/device';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { type AccountInfo } from '@trezor/connect';

import { addDiscoveredLedgerWallet } from './addDiscoveredLedgerWallet';
import { accountsActions } from '../accounts/accountsActions';

describe('addDiscoveredLedgerWallet', () => {
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
            label: 'Ledger Flex',
            staticSessionId: 'ledgerwallet@ledger:0' as const,
        };

        addDiscoveredLedgerWallet(dispatch, [], {
            wallet,
            accounts: [
                {
                    symbol: asNetworkSymbol('btc'),
                    accountType: 'normal',
                    index: 0,
                    path: "m/84'/0'/0'",
                    accountInfo,
                    visible: true,
                },
            ],
        });

        expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
            type: deviceActions.connectLedgerDevice.type,
            payload: {
                provider: 'ledger',
                id: wallet.id,
                name: wallet.label,
                features: { label: wallet.label },
                state: { staticSessionId: wallet.staticSessionId },
            },
        });
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
        expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('inserts BTC and ETH into ordinary accounts with their own types and derivation paths', () => {
        const dispatch = jest.fn();
        const wallet = {
            id: 'ledgerwallet',
            label: 'My wallet',
            staticSessionId: 'ledgerwallet@ledger:0' as const,
            supportedNetworks: [asNetworkSymbol('btc'), asNetworkSymbol('eth')],
            accountsDiscoveryAppVersion: '0.1.0',
        };
        addDiscoveredLedgerWallet(dispatch, [], {
            wallet,
            accounts: [
                {
                    symbol: asNetworkSymbol('btc'),
                    accountType: 'legacy',
                    index: 0,
                    path: "m/44'/0'/0'",
                    visible: false,
                    accountInfo: {
                        descriptor: 'xpubfixture',
                        empty: true,
                        balance: '0',
                        availableBalance: '0',
                        history: { total: 0, unconfirmed: 0 },
                    },
                },
                {
                    symbol: asNetworkSymbol('eth'),
                    accountType: 'normal',
                    index: 0,
                    path: "m/44'/60'/0'/0/0",
                    visible: true,
                    accountInfo: {
                        descriptor: '0x1234567890abcdef1234567890abcdef12345678',
                        empty: true,
                        balance: '0',
                        availableBalance: '0',
                        history: { total: 0, unconfirmed: 0 },
                    },
                },
            ],
        });
        expect(dispatch.mock.calls[1][0].payload.account).toMatchObject({
            symbol: 'btc',
            accountType: 'legacy',
            visible: false,
        });
        expect(dispatch.mock.calls[2][0].payload.account).toMatchObject({
            symbol: 'eth',
            accountType: 'normal',
            path: "m/44'/60'/0'/0/0",
            visible: true,
            networkType: 'ethereum',
        });
        expect(dispatch.mock.calls[0][0].payload.unavailableCapabilities.eth).toBeUndefined();
    });

    it('refreshes an existing account without discarding its custom label or metadata', () => {
        const dispatch = jest.fn();
        const wallet = {
            id: 'ledgerwallet',
            label: 'Ledger Flex',
            staticSessionId: 'ledgerwallet@ledger:0' as const,
        };
        const accountInfo = {
            descriptor: 'zpubaccount',
            empty: false,
            balance: '100',
            availableBalance: '100',
            history: { total: 1, unconfirmed: 0 },
        } as AccountInfo;
        const existingAccount = mockWalletAccount({
            deviceState: wallet.staticSessionId,
            symbol: asNetworkSymbol('btc'),
            index: 0,
            accountType: 'normal',
            descriptor: asAccountDescriptor(accountInfo.descriptor),
            accountLabel: 'My Ledger savings',
            metadata: { key: 'custom-metadata-key' },
            visible: true,
        });

        addDiscoveredLedgerWallet(dispatch, [existingAccount], {
            wallet,
            accounts: [
                {
                    symbol: asNetworkSymbol('btc'),
                    accountType: 'normal',
                    index: 0,
                    path: "m/84'/0'/0'",
                    accountInfo,
                    visible: true,
                },
            ],
        });

        expect(dispatch.mock.calls[1]?.[0]).toMatchObject({
            type: accountsActions.updateAccount.type,
            payload: {
                account: {
                    accountLabel: 'My Ledger savings',
                    metadata: existingAccount.metadata,
                    balance: '100',
                },
            },
        });
    });
});
