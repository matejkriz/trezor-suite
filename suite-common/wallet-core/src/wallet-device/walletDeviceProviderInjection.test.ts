import { createMockDeps } from '@suite-common/dependency-injection';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { createWalletDeviceService } from './createWalletDeviceService';
import { type WalletDeviceOperations, type WalletDeviceServiceDeps } from './walletDeviceTypes';

describe('wallet device provider injection', () => {
    it('delegates device operations and lifecycle to the injected provider', async () => {
        const operations = createMockDeps<WalletDeviceOperations>({
            discoverAccounts: null,
            confirmAddress: null,
            signTransaction: null,
            cancelAction: () => Promise.resolve(),
            disconnect: () => Promise.resolve(),
        });
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            getOperations: () => operations,
            cancelTrezorAction: () => Promise.resolve(),
        });
        const device = mockSuiteDevice();
        const service = createWalletDeviceService(deps);

        expect(service.get(device)).toBe(operations);
        await service.cancelAction({ device, reason: 'tx-timeout' });
        await service.disconnect(device);

        expect(operations.cancelAction).toHaveBeenCalledWith('tx-timeout');
        expect(operations.disconnect).toHaveBeenCalled();
        expect(deps.cancelTrezorAction).not.toHaveBeenCalled();
    });

    it('retains injected Connect cancellation for devices without another provider', async () => {
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            getOperations: () => undefined,
            cancelTrezorAction: () => Promise.resolve(),
        });

        await createWalletDeviceService(deps).cancelAction({ reason: 'tx-timeout' });

        expect(deps.cancelTrezorAction).toHaveBeenCalledWith('tx-timeout');
    });
});
