import { isLedgerDevice } from '@suite-common/device';
import TrezorConnect from '@trezor/connect';

import { createLedgerWalletDeviceOperations } from './createLedgerWalletDeviceOperations';
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
    get: device =>
        isLedgerDevice(device) ? createLedgerWalletDeviceOperations(deps, device) : undefined,
    async cancelAction({ device, reason }) {
        if (isLedgerDevice(device)) {
            const owner = device.state?.sessionId;
            if (!device.connected || !owner || !deps.ledgerBitcoinService.isConnectionOwner(owner))
                return;

            const cancellationReason = typeof reason === 'string' ? reason : reason?.reason;
            deps.ledgerBitcoinService.cancelAction(
                cancellationReason === 'tx-timeout' ? 'timeout' : 'cancelled',
            );
        } else {
            await TrezorConnect.cancel(reason);
        }
    },
    async disconnect(device) {
        if (isLedgerDevice(device)) {
            const owner = device.state?.sessionId;
            if (!device.connected || !owner || !deps.ledgerBitcoinService.isConnectionOwner(owner))
                return;

            await deps.ledgerBitcoinService.disconnect({ owner });
        }
    },
});

export const injectWalletDeviceService = (
    services: WalletDeviceServiceDep,
): WalletDeviceServiceDep => ({
    walletDeviceService: services.walletDeviceService,
});
