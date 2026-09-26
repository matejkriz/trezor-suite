import { Linking } from 'react-native';

import { DeviceModel, DeviceModelId } from '@ledgerhq/device-management-kit';

import { createMockDeps } from '@suite-common/dependency-injection';
import { type LedgerBitcoinServiceDep, type LedgerDevice } from '@suite-common/ledger';
import { connectLedgerBitcoinWalletThunk } from '@suite-common/wallet-core';
import { type BluetoothPermissionStatus } from '@suite-native/bluetooth';
import { getTranslation } from '@suite-native/intl';
import { act, fireEvent, renderWithStoreProvider, waitFor } from '@suite-native/test-utils-store';

import { ConnectLedgerDeviceScreenContent } from './ConnectLedgerDeviceScreenContent';

const mockGoBack = jest.fn();
const mockRequestBluetoothPermission = jest.fn();
const mockAbort = jest.fn();
const mockUnwrap = jest.fn();
const mockStopScanning = jest.fn(() => Promise.resolve());

jest.mock('@suite-native/bluetooth', () => ({
    ...jest.requireActual('@suite-native/bluetooth'),
    useBluetoothPermissions: () => ({ requestBluetoothPermission: mockRequestBluetoothPermission }),
}));

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    connectLedgerBitcoinWalletThunk: jest.fn(() => () => ({
        unwrap: mockUnwrap,
        abort: mockAbort,
    })),
}));

const device: LedgerDevice = {
    id: 'test-ledger',
    name: 'My travel wallet',
    transport: 'react-native-ble',
    deviceModel: new DeviceModel({
        id: 'flex',
        model: DeviceModelId.FLEX,
        name: 'Ledger Flex',
    }),
};

const renderScreen = async (
    permissionStatus: BluetoothPermissionStatus = 'granted',
    expectedDeviceId?: string,
) => {
    const deps = createMockDeps<LedgerBitcoinServiceDep>({
        ledgerBitcoinService: {
            startDiscovery: () => mockStopScanning,
            stopDiscovery: () => Promise.resolve(),
            listenToAvailableDevices: null,
            connect: null,
            isConnectionOwner: null,
            getDeviceInfo: null,
            getMasterFingerprint: null,
            getAccount: null,
            verifyAddress: null,
            signPsbt: null,
            signTransaction: null,
            disconnect: null,
            dispose: null,
            cancelAction: null,
        },
    });

    const view = await renderWithStoreProvider(
        <ConnectLedgerDeviceScreenContent
            onConnected={mockGoBack}
            expectedDeviceId={expectedDeviceId}
        />,
        {
            preloadedState: { bluetooth: { permissionStatus } },
            services: deps,
        },
    );

    return { ...view, service: deps.ledgerBitcoinService };
};

describe('ConnectLedgerDeviceScreenContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUnwrap.mockResolvedValue(undefined);
    });

    it('scans automatically and connects the selected named device through the shared thunk', async () => {
        const { service, getByText, getByTestId } = await renderScreen();

        expect(getByText(getTranslation('moduleConnectLedger.status'))).toBeTruthy();
        expect(service.startDiscovery).toHaveBeenCalledTimes(1);

        await act(() => service.startDiscovery.mock.calls[0]?.[0](device));

        expect(getByText('My travel wallet')).toBeTruthy();
        await fireEvent.press(getByTestId('@connect-ledger/device'));

        expect(connectLedgerBitcoinWalletThunk).toHaveBeenCalledWith({
            device,
            apiType: 'bluetooth',
            expectedDeviceId: undefined,
        });
        await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
        expect(service.connect).not.toHaveBeenCalled();
    });

    it('requests Bluetooth permission before scanning', async () => {
        const { service } = await renderScreen('denied');

        expect(mockRequestBluetoothPermission).toHaveBeenCalledTimes(1);
        expect(service.startDiscovery).not.toHaveBeenCalled();
    });

    it('requires the same wallet when reconnecting a remembered Ledger', async () => {
        const { service, getByTestId } = await renderScreen('granted', 'remembered-ledger-wallet');
        await act(() => service.startDiscovery.mock.calls[0]?.[0](device));
        await fireEvent.press(getByTestId('@connect-ledger/device'));

        expect(connectLedgerBitcoinWalletThunk).toHaveBeenCalledWith({
            device,
            apiType: 'bluetooth',
            expectedDeviceId: 'remembered-ledger-wallet',
        });
    });

    it('opens system settings when Bluetooth permission is blocked', async () => {
        const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
        const { service, getByText } = await renderScreen('blocked');

        await fireEvent.press(getByText(getTranslation('moduleConnectLedger.settingsButton')));

        expect(openSettings).toHaveBeenCalledTimes(1);
        expect(mockRequestBluetoothPermission).not.toHaveBeenCalled();
        expect(service.startDiscovery).not.toHaveBeenCalled();
        openSettings.mockRestore();
    });

    it('keeps connection errors local and offers retry without displaying confidential error data', async () => {
        mockUnwrap.mockRejectedValue(new Error('private device label'));
        const { service, getByText, getByTestId, queryByText } = await renderScreen();
        await act(() => service.startDiscovery.mock.calls[0]?.[0](device));
        await fireEvent.press(getByTestId('@connect-ledger/device'));

        await waitFor(() =>
            expect(getByText(getTranslation('moduleConnectLedger.error'))).toBeTruthy(),
        );
        expect(queryByText('private device label')).toBeNull();
        expect(mockGoBack).not.toHaveBeenCalled();
        await fireEvent.press(getByText(getTranslation('moduleConnectLedger.retry')));
        expect(service.startDiscovery).toHaveBeenCalledTimes(2);
    });

    it('cancels pending connection and scanning on exit without disposing the shared service', async () => {
        mockUnwrap.mockReturnValue(
            new Promise((_resolve, reject) => {
                mockAbort.mockImplementationOnce(() => reject(new Error('Canceled')));
            }),
        );
        const { service, getByTestId, unmount } = await renderScreen();
        await act(() => service.startDiscovery.mock.calls[0]?.[0](device));
        await fireEvent.press(getByTestId('@connect-ledger/device'));
        await waitFor(() => expect(mockUnwrap).toHaveBeenCalled());
        mockStopScanning.mockClear();
        await unmount();

        expect(mockAbort).toHaveBeenCalledTimes(1);
        expect(mockStopScanning).toHaveBeenCalledTimes(1);
        expect(service.stopDiscovery).not.toHaveBeenCalled();
        expect(service.dispose).not.toHaveBeenCalled();
    });
});
