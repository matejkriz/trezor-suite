import { createMockDeps } from '@suite-common/dependency-injection';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';

import { type WalletDeviceServiceDep } from './createWalletDeviceService';
import { cancelDeviceActionThunk, disconnectWalletDeviceThunk } from './walletDeviceThunks';

describe('wallet device lifecycle', () => {
    it('cancels the selected device through DI with the caller reason', async () => {
        const device = mockSuiteDevice();
        const deps = createMockDeps<WalletDeviceServiceDep>({
            walletDeviceService: {
                get: null,
                cancelAction: () => Promise.resolve(),
                disconnect: null,
            },
        });
        const store = createTestStore({
            extra: { services: deps },
            preloadedState: { device: { selectedDevice: device } },
        });

        await store.dispatch(cancelDeviceActionThunk({ reason: 'tx-timeout' }));

        expect(deps.walletDeviceService.cancelAction).toHaveBeenCalledWith({
            device,
            reason: 'tx-timeout',
        });
    });

    it('disconnects the requested device through DI', async () => {
        const device = mockSuiteDevice();
        const deps = createMockDeps<WalletDeviceServiceDep>({
            walletDeviceService: {
                get: null,
                cancelAction: null,
                disconnect: () => Promise.resolve(),
            },
        });
        const store = createTestStore({ extra: { services: deps } });

        await store.dispatch(disconnectWalletDeviceThunk({ device }));

        expect(deps.walletDeviceService.disconnect).toHaveBeenCalledWith(device);
    });
});
