import { asNetworkSymbol, getSupportedNetworks } from '@suite-common/wallet-config';
import { DeviceModelInternal, hasBitcoinOnlyFirmware } from '@trezor/device-utils';

import { createLedgerSuiteDevice } from './createLedgerSuiteDevice';

describe(createLedgerSuiteDevice.name, () => {
    const wallet = {
        id: 'ledgerwallet',
        label: 'Ledger Flex',
        staticSessionId: 'ledgerwallet@ledger:0' as const,
        sessionId: 'acquisition-a',
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
            state: { staticSessionId: wallet.staticSessionId, sessionId: wallet.sessionId },
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
        expect(hasBitcoinOnlyFirmware(createLedgerSuiteDevice(wallet))).toBe(true);
    });

    it('keeps details read from Ledger for Device settings', () => {
        const deviceInfo = {
            name: 'My Ledger',
            model: 'Ledger Flex',
            osVersion: '1.3.0',
            bitcoinAppVersion: '2.4.0',
            batteryLevel: 80,
        };
        const device = createLedgerSuiteDevice({
            ...wallet,
            label: deviceInfo.name,
            deviceInfo,
        });

        expect(device.ledgerInfo).toEqual({
            model: deviceInfo.model,
            osVersion: deviceInfo.osVersion,
            bitcoinAppVersion: deviceInfo.bitcoinAppVersion,
            batteryLevel: deviceInfo.batteryLevel,
        });
        expect(device.features.label).toBe('My Ledger');
    });

    it('preserves custom app metadata and enables only discovered network capabilities', () => {
        const device = createLedgerSuiteDevice({
            ...wallet,
            supportedNetworks: [asNetworkSymbol('btc'), asNetworkSymbol('eth')],
            accountsDiscoveryAppVersion: '0.1.0',
        });

        expect(device.unavailableCapabilities.btc).toBeUndefined();
        expect(device.unavailableCapabilities.eth).toBeUndefined();
        expect(device.unavailableCapabilities.ada).toBe('no-support');
        expect(device.unavailableCapabilities['settings.firmwareUpdate']).toBe('no-support');
        expect(device.unavailableCapabilities['settings.authenticity']).toBe('no-support');
        expect(device.ledgerInfo?.accountsDiscoveryAppVersion).toBe('0.1.0');
        expect(device.features.capabilities).toContain('Capability_Ethereum');
        expect(device.features.capabilities).not.toContain('Capability_Cardano');
        expect(hasBitcoinOnlyFirmware(device)).toBe(false);
    });

    it('reflects discovered network families without duplicate firmware capabilities', () => {
        const device = createLedgerSuiteDevice({
            ...wallet,
            supportedNetworks: ['btc', 'eth', 'arb', 'xrp', 'sol', 'xlm', 'trx'].map(
                asNetworkSymbol,
            ),
        });

        expect(device.features.capabilities).toEqual([
            'Capability_Bitcoin_like',
            'Capability_Ethereum',
            'Capability_Ripple',
            'Capability_Solana',
            'Capability_Stellar',
            'Capability_Tron',
        ]);
    });

    it('uses the native Bluetooth transport and disables unsupported device settings', () => {
        const device = createLedgerSuiteDevice(wallet, 'bluetooth');

        expect(device.descriptor.apiType).toBe('bluetooth');
        for (const capability of [
            'settings.rename',
            'settings.pin',
            'settings.backup',
            'settings.passphrase',
            'settings.firmwareUpdate',
            'settings.wipe',
            'settings.bluetoothPairing',
        ] as const) {
            expect(device.unavailableCapabilities[capability]).toBe('no-support');
        }
    });
});
