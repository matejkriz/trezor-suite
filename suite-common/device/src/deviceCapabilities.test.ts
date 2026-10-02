import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { getDeviceOperationCapabilities, isDeviceCapabilitySupported } from './deviceCapabilities';

describe('device operation eligibility', () => {
    it('preserves Trezor operations and honors individual unavailable capabilities', () => {
        const device = mockSuiteDevice({
            unavailableCapabilities: { 'device.manualAccounts': 'no-support' },
        });

        expect(getDeviceOperationCapabilities(device)).toEqual({
            trezorConnect: true,
            manualAccounts: false,
            messageSigning: true,
            metadataEncryption: true,
            recovery: true,
            reset: true,
            firmwareChecks: true,
        });
    });

    it('protects restored provider devices without a capability snapshot', () => {
        const device = { ...mockSuiteDevice(), provider: 'ledger' as const };

        expect(Object.values(getDeviceOperationCapabilities(device))).not.toContain(true);
        expect(isDeviceCapabilitySupported(device, 'settings.passphrase')).toBe(false);
    });

    it('accepts explicitly enabled provider operations', () => {
        const device = {
            ...mockSuiteDevice({ unavailableCapabilities: { 'device.messageSigning': undefined } }),
            provider: 'ledger' as const,
        };

        expect(getDeviceOperationCapabilities(device).messageSigning).toBe(true);
        expect(getDeviceOperationCapabilities(device).trezorConnect).toBe(false);
    });
});
