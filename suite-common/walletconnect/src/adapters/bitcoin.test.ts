import { type WalletKitTypes } from '@reown/walletkit';

import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import TrezorConnect from '@trezor/connect';

import { type BitcoinRequestThunkDeps, bitcoinAdapter } from './bitcoin';

jest.mock('@suite-common/connect-popup', () => ({}));
jest.mock('@suite-common/device', () => ({
    selectSelectedDevice: (state: { device: { selectedDevice: unknown } }) =>
        state.device.selectedDevice,
    isLedgerDevice: (device: { provider?: string }) => device.provider === 'ledger',
}));
jest.mock('@suite-common/wallet-core', () => ({ selectAccounts: () => [] }));
jest.mock('@trezor/connect', () => ({
    __esModule: true,
    default: { call: jest.fn() },
}));

describe('Ledger Bitcoin WalletConnect requests', () => {
    it('rejects requests before invoking TrezorConnect', async () => {
        const store = createTestStore({
            extra: {} as BitcoinRequestThunkDeps,
            preloadedState: {
                device: {
                    selectedDevice: {
                        ...mockSuiteDevice({
                            connected: true,
                            state: { staticSessionId: 'ledger-wallet@ledger:0' },
                        }),
                        provider: 'ledger' as const,
                    },
                },
            },
        });
        const connectCall = jest.spyOn(TrezorConnect, 'call');

        const result = await store.dispatch(
            bitcoinAdapter.requestThunk({ event: {} as WalletKitTypes.SessionRequest }),
        );

        expect(result.type).toContain('/rejected');
        if (bitcoinAdapter.requestThunk.rejected.match(result)) {
            expect(result.error.message).toBe('Ledger accounts are not supported by WalletConnect');
        }
        expect(connectCall).not.toHaveBeenCalled();
        connectCall.mockRestore();
    });
});
