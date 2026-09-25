import { getSupportedNetworks } from '@suite-common/wallet-config';
import { DeviceModelInternal } from '@trezor/device-utils';

import { createLedgerSuiteDevice } from './createLedgerSuiteDevice';

describe(createLedgerSuiteDevice.name, () => {
    const wallet = {
        id: 'ledgerwallet',
        label: 'Ledger Flex',
        staticSessionId: 'ledgerwallet@ledger:0' as const,
    };

    it('creates a remembered acquired device with its real name and wallet state', () => {
        const device = createLedgerSuiteDevice(wallet);

        expect(device).toMatchObject({
            type: 'acquired',
            provider: 'ledger',
            id: wallet.id,
            connected: true,
            remember: true,
            name: wallet.label,
            state: { staticSessionId: wallet.staticSessionId },
            features: {
                label: wallet.label,
                vendor: 'Ledger',
                internal_model: DeviceModelInternal.UNKNOWN,
            },
            firmware: 'unknown',
            authenticityChecks: { firmwareHash: null, firmwareRevision: null },
        });
    });

    it('allows BTC and marks every other network and unsupported operation unavailable', () => {
        const { unavailableCapabilities } = createLedgerSuiteDevice(wallet);

        expect(unavailableCapabilities.btc).toBeUndefined();
        getSupportedNetworks()
            .filter(symbol => symbol !== 'btc')
            .forEach(symbol => expect(unavailableCapabilities[symbol]).toBe('no-support'));
        expect(unavailableCapabilities.coinjoin).toBe('no-support');
        expect(unavailableCapabilities.taproot).toBe('no-support');
        expect(unavailableCapabilities.evolu).toBe('no-support');
        expect(unavailableCapabilities.getFirmwareHash).toBe('no-support');
    });
});
