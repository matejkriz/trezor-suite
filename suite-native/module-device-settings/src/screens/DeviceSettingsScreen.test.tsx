import { type PropsWithChildren } from 'react';

import { deviceReducerInitialState } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { Text } from '@suite-native/atoms';
import { getTranslation } from '@suite-native/intl';
import { renderWithStoreProvider } from '@suite-native/test-utils-store';
import { DeviceModelInternal } from '@trezor/device-utils';

import { DeviceSettingsScreen } from './DeviceSettingsScreen';

jest.mock('../hooks/useDeviceChangedCheck', () => ({ useDeviceChangedCheck: jest.fn() }));
jest.mock('@suite-native/navigation', () => ({
    ...jest.requireActual('@suite-native/navigation'),
    useNavigateToInitialScreen: () => jest.fn(),
    Screen: ({ children }: PropsWithChildren) => children,
    ScreenHeader: () => null,
}));
jest.mock('../components/DeviceFirmwareCard', () => ({
    DeviceFirmwareCard: () => <Text>Firmware update</Text>,
}));
jest.mock('../components/DeviceConnectionCard', () => ({
    DeviceConnectionCard: () => <Text>Connection settings</Text>,
}));
jest.mock('../components/DevicePinProtectionCard', () => ({
    DevicePinProtectionCard: () => <Text>PIN settings</Text>,
}));
jest.mock('../components/BackupAndPassphraseCard', () => ({
    BackupAndPassphraseCard: () => <Text>Backup and passphrase</Text>,
}));
jest.mock('../components/DeviceAuthenticityCard', () => ({
    DeviceAuthenticityCard: () => <Text>Authenticity check</Text>,
}));
jest.mock('../components/WipeDeviceCard', () => ({
    WipeDeviceCard: () => <Text>Wipe device</Text>,
}));

describe('DeviceSettingsScreen', () => {
    const renderSettings = (isLedger: boolean) => {
        const selectedDevice = {
            ...mockSuiteDevice(
                {
                    label: 'My hardware wallet',
                    name: 'Hardware wallet',
                    unavailableCapabilities: isLedger
                        ? {
                              'settings.rename': 'no-support' as const,
                              'settings.firmwareUpdate': 'no-support' as const,
                              'settings.pin': 'no-support' as const,
                              'settings.backup': 'no-support' as const,
                              'settings.passphrase': 'no-support' as const,
                              'settings.wipe': 'no-support' as const,
                          }
                        : {},
                },
                {
                    label: 'My hardware wallet',
                    internal_model: isLedger
                        ? DeviceModelInternal.UNKNOWN
                        : DeviceModelInternal.T3B1,
                },
            ),
            ...(isLedger
                ? {
                      provider: 'ledger' as const,
                      ledgerInfo: {
                          model: 'Ledger Flex',
                          osVersion: '1.2.3',
                          bitcoinAppVersion: '2.4.0',
                          batteryLevel: 0,
                      },
                  }
                : {}),
        };

        return renderWithStoreProvider(<DeviceSettingsScreen />, {
            preloadedState: {
                device: { ...deviceReducerInitialState, selectedDevice, devices: [selectedDevice] },
                wallet: { discovery: {} },
            },
        });
    };

    it('keeps Ledger settings with its custom name, SDK info and connection controls', async () => {
        const { getByText, queryByText, queryByTestId } = await renderSettings(true);

        expect(getByText('My hardware wallet')).toBeOnTheScreen();
        expect(getByText('Ledger Flex')).toBeOnTheScreen();
        expect(getByText('1.2.3')).toBeOnTheScreen();
        expect(getByText('2.4.0')).toBeOnTheScreen();
        expect(getByText('0%')).toBeOnTheScreen();
        expect(getByText('Connection settings')).toBeOnTheScreen();
        expect(queryByTestId('@device-name/change-button')).not.toBeOnTheScreen();
        for (const title of [
            'Firmware update',
            'PIN settings',
            'Backup and passphrase',
            'Authenticity check',
            'Wipe device',
        ]) {
            expect(queryByText(title)).not.toBeOnTheScreen();
        }
        expect(
            queryByText(getTranslation('moduleDeviceSettings.sectionTitles.security')),
        ).not.toBeOnTheScreen();
        expect(
            queryByText(getTranslation('moduleDeviceSettings.sectionTitles.dangerZone')),
        ).not.toBeOnTheScreen();
    });

    it('preserves supported Trezor settings and renaming', async () => {
        const { getByText, getByTestId } = await renderSettings(false);

        for (const title of [
            'Firmware update',
            'Connection settings',
            'PIN settings',
            'Backup and passphrase',
            'Authenticity check',
            'Wipe device',
        ]) {
            expect(getByText(title)).toBeOnTheScreen();
        }
        expect(getByTestId('@device-name/change-button')).toBeOnTheScreen();
    });
});
