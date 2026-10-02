import { DEFAULT_FLAGSHIP_MODEL } from '@suite-common/suite-constants';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { type Device } from '@trezor/connect';
import { DeviceModelInternal } from '@trezor/device-utils';

import { portfolioTrackerDevice } from './deviceConstants';
import { deviceReducerInitialState } from './deviceReducer';
import {
    getDeviceSettingsCapabilities,
    selectDeviceBrandName,
    selectDeviceModelWithFlagshipFallback,
    selectDeviceSettingsCapabilities,
    selectIsAnyDeviceSelected,
    selectIsDeviceAuthenticityCheckSupported,
} from './deviceSelectors';

describe('device settings capabilities', () => {
    it('hides unsupported personalization for a restored provider device', () => {
        const device = { ...mockSuiteDevice(), provider: 'ledger' as const };

        expect(getDeviceSettingsCapabilities(device)).toMatchObject({
            rename: false,
            language: false,
            homescreen: false,
            displayRotation: false,
            brightness: false,
            hapticFeedback: false,
            autoLock: false,
            safetyChecks: false,
            wipeCode: false,
        });
    });
    it('accepts a Connect device before wallet fields are populated', () => {
        const device: Device = mockSuiteDevice(
            { unavailableCapabilities: { 'settings.rename': 'no-support' } },
            { internal_model: DeviceModelInternal.T3B1 },
        );

        expect(getDeviceSettingsCapabilities(device)).toMatchObject({
            rename: false,
            authenticity: true,
        });
    });

    it('keeps Trezor management settings and honors model authenticity support', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice({}, { internal_model: DeviceModelInternal.T2T1 }),
            },
        };

        expect(selectDeviceSettingsCapabilities(state)).toEqual({
            rename: true,
            pin: true,
            backup: true,
            passphrase: true,
            firmwareUpdate: true,
            wipe: true,
            authenticity: false,
            bluetoothPairing: true,
            language: true,
            homescreen: true,
            displayRotation: true,
            brightness: true,
            hapticFeedback: true,
            autoLock: true,
            safetyChecks: true,
            wipeCode: true,
        });
        expect(selectDeviceBrandName(state)).toBe('Trezor');
    });

    it('uses unavailable capabilities for external wallet settings', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: {
                    ...mockSuiteDevice({
                        unavailableCapabilities: {
                            'settings.rename': 'no-support',
                            'settings.pin': 'no-support',
                            'settings.backup': 'no-support',
                            'settings.passphrase': 'no-support',
                            'settings.firmwareUpdate': 'no-support',
                            'settings.wipe': 'no-support',
                            'settings.bluetoothPairing': 'no-support',
                        },
                    }),
                    provider: 'ledger' as const,
                },
            },
        };

        expect(selectDeviceSettingsCapabilities(state)).toEqual({
            rename: false,
            pin: false,
            backup: false,
            passphrase: false,
            firmwareUpdate: false,
            wipe: false,
            authenticity: false,
            bluetoothPairing: false,
            language: false,
            homescreen: false,
            displayRotation: false,
            brightness: false,
            hapticFeedback: false,
            autoLock: false,
            safetyChecks: false,
            wipeCode: false,
        });
        expect(selectDeviceBrandName(state)).toBe('Ledger');
    });

    it('honors an explicit unavailable authenticity capability for a supported Trezor', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice(
                    { unavailableCapabilities: { 'settings.authenticity': 'no-support' } },
                    { internal_model: DeviceModelInternal.T3B1 },
                ),
            },
        };

        expect(selectDeviceSettingsCapabilities(state).authenticity).toBe(false);
    });
});

describe(selectIsAnyDeviceSelected.name, () => {
    it('includes a selected Ledger device', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: {
                    ...mockSuiteDevice({ id: 'ledger1', name: 'Ledger Flex' }),
                    provider: 'ledger' as const,
                },
            },
        };

        expect(selectIsAnyDeviceSelected(state)).toBe(true);
    });
});

describe(selectIsDeviceAuthenticityCheckSupported.name, () => {
    it('returns true for supported Trezor Safe devices', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice({}, { internal_model: DeviceModelInternal.T3B1 }),
            },
        };

        expect(selectIsDeviceAuthenticityCheckSupported(state)).toBe(true);
    });

    it.each([DeviceModelInternal.T2T1, DeviceModelInternal.T1B1])(
        'returns false for Trezor model %s without authenticity-check support',
        internalModel => {
            const state = {
                device: {
                    ...deviceReducerInitialState,
                    selectedDevice: mockSuiteDevice({}, { internal_model: internalModel }),
                },
            };

            expect(selectIsDeviceAuthenticityCheckSupported(state)).toBe(false);
        },
    );

    it('returns false for a Ledger with the synthetic unknown model', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: {
                    ...mockSuiteDevice({}, { internal_model: DeviceModelInternal.UNKNOWN }),
                    provider: 'ledger' as const,
                },
            },
        };

        expect(selectIsDeviceAuthenticityCheckSupported(state)).toBe(false);
    });

    it('keeps authenticity checks for an unknown Trezor model', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice(
                    {},
                    { internal_model: DeviceModelInternal.UNKNOWN },
                ),
            },
        };

        expect(selectIsDeviceAuthenticityCheckSupported(state)).toBe(true);
    });

    it('returns true for portfolio tracker device', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: portfolioTrackerDevice,
            },
        };

        expect(selectIsDeviceAuthenticityCheckSupported(state)).toBe(true);
    });
});

describe(selectDeviceModelWithFlagshipFallback.name, () => {
    it('returns the model of the selected device', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice({}, { internal_model: DeviceModelInternal.T3T1 }),
            },
        };

        expect(selectDeviceModelWithFlagshipFallback(state)).toBe(DeviceModelInternal.T3T1);
    });

    it('returns the flagship model when the model of the selected device cannot be read', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: mockSuiteDevice(
                    {},
                    { internal_model: DeviceModelInternal.UNKNOWN },
                ),
            },
        };

        expect(selectDeviceModelWithFlagshipFallback(state)).toBe(DEFAULT_FLAGSHIP_MODEL);
    });

    it('returns the flagship model when no device is selected', () => {
        const state = {
            device: {
                ...deviceReducerInitialState,
                selectedDevice: undefined,
            },
        };

        expect(selectDeviceModelWithFlagshipFallback(state)).toBe(DEFAULT_FLAGSHIP_MODEL);
    });
});
