/**
 * @jest-environment jsdom
 */
import { createMockDeps } from '@suite-common/dependency-injection';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot, renderHookWithStoreProvider } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import {
    type WalletDeviceOperations,
    type WalletDeviceServiceDep,
} from './createWalletDeviceService';
import { useWalletDeviceAccountCapabilities } from './useWalletDeviceAccountCapabilities';

const account = mockWalletAccount({ symbol: asNetworkSymbol('btc') });
const device = mockSuiteDevice({ connected: false });

const renderCapabilities = (operations?: WalletDeviceOperations, hasDevice = true) => {
    const services = createMockDeps<WalletDeviceServiceDep>({
        walletDeviceService: {
            get: () => operations,
            cancelAction: null,
            disconnect: null,
        },
    });
    const root = createTestCompositionRoot({
        extra: { services },
        preloadedState: { device: { selectedDevice: hasDevice ? device : undefined } },
    });
    const view = renderHookWithStoreProvider(() => useWalletDeviceAccountCapabilities(account), {
        root,
    });

    return { ...view, services };
};

describe(useWalletDeviceAccountCapabilities.name, () => {
    it('preserves default capabilities for a remembered disconnected Trezor', () => {
        const { result, services } = renderCapabilities();

        expect(result.current).toEqual({ canSignTransaction: true, canConfirmAddress: true });
        expect(services.walletDeviceService.get).toHaveBeenCalledWith(device);
    });

    it('uses the selected device adapter for public discovery accounts', () => {
        const operations = createMockDeps<WalletDeviceOperations>({
            discoverAccounts: null,
            confirmAddress: null,
            signTransaction: null,
            getAccountCapabilities: () => ({
                canSignTransaction: false,
                canConfirmAddress: false,
            }),
        });
        const { result } = renderCapabilities(operations);

        expect(result.current).toEqual({ canSignTransaction: false, canConfirmAddress: false });
        expect(operations.getAccountCapabilities).toHaveBeenCalledWith(account);
        expect(operations.signTransaction).not.toHaveBeenCalled();
        expect(operations.confirmAddress).not.toHaveBeenCalled();
    });

    it('does not resolve a device adapter when no device is selected', () => {
        const { result, services } = renderCapabilities(undefined, false);

        expect(result.current).toEqual({ canSignTransaction: true, canConfirmAddress: true });
        expect(services.walletDeviceService.get).not.toHaveBeenCalled();
    });
});
