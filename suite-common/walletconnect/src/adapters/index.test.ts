import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { type StaticSessionId } from '@trezor/connect';

import { getNamespaces } from './index';

jest.mock('./bitcoin', () => ({
    bitcoinAdapter: {
        getNamespace: (accounts: { descriptor: string }[]) => ({
            bip122: { accounts: accounts.map(account => account.descriptor) },
        }),
    },
}));
jest.mock('./ethereum', () => ({ ethereumAdapter: { getNamespace: () => ({}) } }));
jest.mock('./solana', () => ({ solanaAdapter: { getNamespace: () => ({}) } }));
jest.mock('./stellar', () => ({ stellarAdapter: { getNamespace: () => ({}) } }));
jest.mock('./tron', () => ({ tronAdapter: { getNamespace: () => ({}) } }));
jest.mock('@suite-common/device', () => ({
    isLedgerDevice: (device: { provider?: string }) => device.provider === 'ledger',
}));

const trezorSessionId = 'trezorwallet@device:0';
const ledgerSessionId = 'ledgerwallet@ledger:0';

const bitcoinAccount = (deviceState: StaticSessionId, address: string) =>
    mockWalletAccount({
        symbol: asNetworkSymbol('btc'),
        descriptor: asAccountDescriptor(deviceState.replaceAll('-', '')),
        deviceState,
        path: "m/84'/0'/0'",
        addresses: {
            change: [],
            used: [],
            unused: [
                {
                    address,
                    path: "m/84'/0'/0'/0/0",
                    transfers: 0,
                    balance: '0',
                    received: '0',
                    sent: '0',
                },
            ],
        },
    });

describe(getNamespaces.name, () => {
    it('excludes Ledger accounts before advertising Bitcoin addresses', () => {
        const ledgerAccount = bitcoinAccount(ledgerSessionId, 'bc1ledger');
        const trezorAccount = bitcoinAccount(trezorSessionId, 'bc1trezor');
        const devices = [
            mockSuiteDevice({ state: { staticSessionId: trezorSessionId } }),
            {
                ...mockSuiteDevice({ state: { staticSessionId: ledgerSessionId } }),
                provider: 'ledger' as const,
            },
        ];

        const namespaces = getNamespaces([ledgerAccount, trezorAccount], devices);

        expect(namespaces.bip122?.accounts).toEqual([trezorAccount.descriptor]);
    });
});
