import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { getWalletConnectAccounts } from './walletConnectAccountEligibility';

describe(getWalletConnectAccounts.name, () => {
    it('does not advertise an orphaned account without a known device', () => {
        const account = mockWalletAccount({
            symbol: asNetworkSymbol('btc'),
            deviceState: 'orphanedwallet@device:0',
        });

        expect(getWalletConnectAccounts([account], [])).toEqual([]);
    });
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
