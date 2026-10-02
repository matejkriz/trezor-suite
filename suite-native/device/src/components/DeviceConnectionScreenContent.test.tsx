import { type ComponentProps } from 'react';

import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { Text } from '@suite-native/atoms';
import { renderWithStoreProvider } from '@suite-native/test-utils-store';

import { type ConnectLedgerDeviceScreenContent } from './ConnectLedgerDeviceScreenContent';
import { DeviceConnectionScreenContent } from './DeviceConnectionScreenContent';

jest.mock('./ConnectAndUnlockDeviceScreenContent', () => ({
    ConnectAndUnlockDeviceScreenContent: () => <Text>USB connection</Text>,
}));
jest.mock('./TurnOnAndUnlockDeviceScreenContent', () => ({
    TurnOnAndUnlockDeviceScreenContent: () => <Text>Bluetooth connection</Text>,
}));
jest.mock('./ConnectLedgerDeviceScreenContent', () => ({
    ConnectLedgerDeviceScreenContent: ({
        expectedDeviceId,
    }: ComponentProps<typeof ConnectLedgerDeviceScreenContent>) => (
        <Text>{`Ledger connection: ${expectedDeviceId}`}</Text>
    ),
}));

describe('device connection content', () => {
    it.each([
        { provider: 'trezor' as const, capabilities: [], expected: 'USB connection' },
        {
            provider: 'trezor' as const,
            capabilities: ['Capability_BLE' as const],
            expected: 'Bluetooth connection',
        },
        {
            provider: 'ledger' as const,
            capabilities: [],
            expected: 'Ledger connection: remembered-wallet',
        },
    ])(
        'chooses $expected and preserves the remembered wallet identity',
        async ({ provider, capabilities, expected }) => {
            const device = {
                ...mockSuiteDevice({ id: 'remembered-wallet' }, { capabilities }),
                provider,
            };
            const { getByText } = await renderWithStoreProvider(<DeviceConnectionScreenContent />, {
                preloadedState: {
                    device: { selectedDevice: device, devices: [device] },
                    bluetooth: { permissionStatus: 'granted' },
                },
            });

            expect(getByText(expected)).toBeOnTheScreen();
        },
    );
});
