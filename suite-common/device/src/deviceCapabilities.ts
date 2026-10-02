import { type Device } from '@trezor/connect';

import { isLedgerDevice } from './ledgerDevice';

export const ledgerUnsupportedDeviceCapabilities = [
    'settings.rename',
    'settings.pin',
    'settings.backup',
    'settings.passphrase',
    'settings.firmwareUpdate',
    'settings.wipe',
    'settings.bluetoothPairing',
    'settings.authenticity',
    'settings.language',
    'settings.homescreen',
    'settings.displayRotation',
    'settings.brightness',
    'settings.hapticFeedback',
    'settings.autoLock',
    'settings.safetyChecks',
    'settings.wipeCode',
    'device.trezorConnect',
    'device.manualAccounts',
    'device.messageSigning',
    'device.metadataEncryption',
    'device.recovery',
    'device.reset',
    'device.firmwareChecks',
    'evolu',
] as const;

export const isDeviceCapabilitySupported = (
    device: Device | undefined,
    capability: string,
): boolean => {
    const unavailable = device?.unavailableCapabilities;
    if (unavailable && capability in unavailable) return unavailable[capability] === undefined;

    // Remembered provider devices from earlier POC versions lack these capability entries.
    return (
        !isLedgerDevice(device) ||
        !ledgerUnsupportedDeviceCapabilities.some(key => key === capability)
    );
};

export const getDeviceOperationCapabilities = (device?: Device) => ({
    trezorConnect: isDeviceCapabilitySupported(device, 'device.trezorConnect'),
    manualAccounts: isDeviceCapabilitySupported(device, 'device.manualAccounts'),
    messageSigning: isDeviceCapabilitySupported(device, 'device.messageSigning'),
    metadataEncryption: isDeviceCapabilitySupported(device, 'device.metadataEncryption'),
    recovery: isDeviceCapabilitySupported(device, 'device.recovery'),
    reset: isDeviceCapabilitySupported(device, 'device.reset'),
    firmwareChecks: isDeviceCapabilitySupported(device, 'device.firmwareChecks'),
});
