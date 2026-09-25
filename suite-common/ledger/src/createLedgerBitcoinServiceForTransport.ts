import { DeviceManagementKitBuilder, type TransportFactory } from '@ledgerhq/device-management-kit';
import { SignerBtcBuilder } from '@ledgerhq/device-signer-kit-bitcoin';

import { createLedgerBitcoinService } from './createLedgerBitcoinService';

export const createLedgerBitcoinServiceForTransport = (
    transportFactory: TransportFactory,
    discoveryMode: 'interactive' | 'available' = 'interactive',
) => {
    const dmk = new DeviceManagementKitBuilder().addTransport(transportFactory).build();

    return createLedgerBitcoinService({
        dmk,
        listenToAvailableDevices:
            discoveryMode === 'available' ? () => dmk.listenToAvailableDevices({}) : undefined,
        createSigner: sessionId => new SignerBtcBuilder({ dmk, sessionId }).build(),
    });
};
