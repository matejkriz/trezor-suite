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
        const root = createTestCompositionRoot({
            preloadedState: {
                device: {
                    selectedDevice: undefined,
                    selectedExternalWalletId: 'ledgerwallet',
                    externalWallets: [
                        {
                            id: 'ledgerwallet',
                            provider: 'ledger',
                            staticSessionId: 'ledgerwallet@ledger:0',
                            connected: true,
                        },
                    ],
                },
            },
        });

        const { result } = renderHookWithStoreProvider(useIsTradingWalletConnected, { root });

        expect(result.current).toBe(true);
    });

    it('returns false for a disconnected selected Ledger', () => {
        const root = createTestCompositionRoot({
            preloadedState: {
                device: {
                    selectedDevice: undefined,
                    selectedExternalWalletId: 'ledgerwallet',
                    externalWallets: [
                        {
                            id: 'ledgerwallet',
                            provider: 'ledger',
                            staticSessionId: 'ledgerwallet@ledger:0',
                            connected: false,
                        },
                    ],
                },
            },
        });

        const { result } = renderHookWithStoreProvider(useIsTradingWalletConnected, { root });

        expect(result.current).toBe(false);
    });
});
