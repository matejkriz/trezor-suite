import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot, renderHookWithStoreProvider } from '@suite-common/test-utils';

import { useIsTradingWalletConnected } from './useIsTradingWalletConnected';

describe(useIsTradingWalletConnected.name, () => {
    it('returns true for a connected selected Trezor', () => {
        const root = createTestCompositionRoot({
            preloadedState: { device: { selectedDevice: { connected: true } } },
        });

        const { result } = renderHookWithStoreProvider(useIsTradingWalletConnected, { root });

        expect(result.current).toBe(true);
    });

    it('returns true for a connected selected Ledger', () => {
        const ledgerDevice = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                state: { staticSessionId: 'ledgerwallet@ledger:0' },
                connected: true,
                available: true,
            }),
            provider: 'ledger' as const,
        };
        const root = createTestCompositionRoot({
            preloadedState: {
                device: {
                    selectedDevice: ledgerDevice,
                },
            },
        });

        const { result } = renderHookWithStoreProvider(useIsTradingWalletConnected, { root });

        expect(result.current).toBe(true);
    });

    it('returns false for a disconnected selected Ledger', () => {
        const ledgerDevice = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                state: { staticSessionId: 'ledgerwallet@ledger:0' },
                connected: false,
                available: false,
            }),
            provider: 'ledger' as const,
        };
        const root = createTestCompositionRoot({
            preloadedState: {
                device: {
                    selectedDevice: ledgerDevice,
                },
            },
        });

        const { result } = renderHookWithStoreProvider(useIsTradingWalletConnected, { root });

        expect(result.current).toBe(false);
    });
});
