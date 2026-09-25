import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { getWalletConnectAccounts } from './walletConnectAccountEligibility';

jest.mock('@suite-common/device', () => ({
    isLedgerDevice: (device: { provider?: string }) => device.provider === 'ledger',
}));

describe(getWalletConnectAccounts.name, () => {
    it('excludes accounts belonging to Ledger devices', () => {
        const trezorState = 'trezorwallet@device:0';
        const ledgerState = 'ledgerwallet@ledger:0';
        const trezorAccount = mockWalletAccount({
            symbol: asNetworkSymbol('btc'),
            deviceState: trezorState,
        });
        const ledgerAccount = mockWalletAccount({
            symbol: asNetworkSymbol('btc'),
            deviceState: ledgerState,
        });
        const devices = [
            mockSuiteDevice({ state: { staticSessionId: trezorState } }),
            {
                ...mockSuiteDevice({ state: { staticSessionId: ledgerState } }),
                provider: 'ledger' as const,
            },
        ];

        expect(getWalletConnectAccounts([ledgerAccount, trezorAccount], devices)).toEqual([
            trezorAccount,
        ]);
    });

    it('excludes a persisted Ledger account when its device is absent', () => {
        const ledgerAccount = mockWalletAccount({
            symbol: asNetworkSymbol('btc'),
            deviceState: 'ledgerwallet@ledger:0',
        });

        expect(getWalletConnectAccounts([ledgerAccount], [])).toEqual([]);
    });
});
