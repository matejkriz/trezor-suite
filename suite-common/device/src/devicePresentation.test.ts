import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { getDeviceBrandName, getDeviceInformation, getDeviceProvider } from './devicePresentation';

describe('device presentation', () => {
    it('uses common information for both providers', () => {
        const deviceInfo = { model: 'Hardware wallet', osVersion: '1.0' };
        const device = mockSuiteDevice({ deviceInfo });

        expect(getDeviceInformation(device)).toEqual(deviceInfo);
        expect(getDeviceProvider(device)).toBe('trezor');
        expect(getDeviceBrandName(device)).toBe('Trezor');
    });

    it('reads remembered Ledger information from the previous storage format', () => {
        const ledgerInfo = { model: 'Ledger Flex', batteryLevel: 42 };
        const device = { ...mockSuiteDevice(), provider: 'ledger' as const, ledgerInfo };

        expect(getDeviceInformation(device)).toEqual(ledgerInfo);
        expect(getDeviceBrandName(device)).toBe('Ledger');
    });
});
