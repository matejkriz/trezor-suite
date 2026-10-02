import {
    type WalletDeviceService,
    type WalletDeviceServiceDep,
    type WalletDeviceServiceDeps,
} from './walletDeviceTypes';

export type {
    ConfirmWalletDeviceAddressParams,
    SignWalletDeviceTransactionParams,
    WalletDeviceAccountCapabilities,
    WalletDeviceOperations,
    CancelWalletDeviceActionParams,
    WalletDeviceServiceDeps,
    WalletDeviceService,
    WalletDeviceServiceDep,
    DiscoverWalletDeviceAccountsParams,
    WalletDeviceDiscoveryResult,
    WalletDeviceDiscoveredAccount,
} from './walletDeviceTypes';

export const createWalletDeviceService = (deps: WalletDeviceServiceDeps): WalletDeviceService => ({
    get: device => deps.getOperations(device),
    async cancelAction({ device, reason }) {
        const operations = device ? deps.getOperations(device) : undefined;
        if (operations) {
            await operations.cancelAction?.(reason);
        } else {
            await deps.cancelTrezorAction(reason);
        }
    },
    async disconnect(device) {
        await deps.getOperations(device)?.disconnect?.();
    },
});

export const injectWalletDeviceService = (
    services: WalletDeviceServiceDep,
): WalletDeviceServiceDep => ({
    walletDeviceService: services.walletDeviceService,
});
