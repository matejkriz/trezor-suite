import {
    DeviceManagementKitBuilder,
    GoToDashboardDeviceAction,
    OpenAppDeviceAction,
    type TransportFactory,
} from '@ledgerhq/device-management-kit';
import { SignerBtcBuilder } from '@ledgerhq/device-signer-kit-bitcoin';

import { createLedgerBitcoinService } from './createLedgerBitcoinService';

export const createLedgerBitcoinServiceForTransport = (
    transportFactory: TransportFactory,
    discoveryMode: 'interactive' | 'available' = 'interactive',
    onDisconnect?: () => void,
) => {
    const dmk = new DeviceManagementKitBuilder().addTransport(transportFactory).build();

    return createLedgerBitcoinService({
        dmk,
        goToDashboard: sessionId =>
            dmk.executeDeviceAction({
                sessionId,
                deviceAction: new GoToDashboardDeviceAction({ input: {} }),
            }),
        openAccountsDiscoveryApp: sessionId =>
            dmk.executeDeviceAction({
                sessionId,
                deviceAction: new OpenAppDeviceAction({ input: { appName: 'Accounts Discovery' } }),
            }),
        listenToAvailableDevices:
            discoveryMode === 'available' ? () => dmk.listenToAvailableDevices({}) : undefined,
        createSigner: sessionId => new SignerBtcBuilder({ dmk, sessionId }).build(),
        onDisconnect,
    });
};
