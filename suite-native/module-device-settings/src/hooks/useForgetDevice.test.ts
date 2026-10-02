import { deviceReducerInitialState } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import {
    DeviceSettingsStackRoutes,
    ForgetDeviceStackRoutes,
    RootStackRoutes,
} from '@suite-native/navigation';
import { act, renderHookWithStoreProvider } from '@suite-native/test-utils-store';

import { useForgetDevice } from './useForgetDevice';

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
const mockShowToast = jest.fn();
const mockUnpairBluetoothDevice = jest.fn();
const mockDisconnect = jest.fn();
const mockForget = jest.fn();

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, popTo: mockPopTo, goBack: jest.fn() }),
}));
jest.mock('@suite-native/bluetooth', () => ({
    ...jest.requireActual('@suite-native/bluetooth'),
    useBluetoothDevice: () => ({ unpairBluetoothDevice: mockUnpairBluetoothDevice }),
    selectIsKnownBluetoothDevice: () => false,
}));
jest.mock('@suite-native/toasts', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    disconnectWalletDeviceThunk: jest
        .requireActual('@reduxjs/toolkit')
        .createAsyncThunk('@test/disconnectWalletDevice', (params: unknown) =>
            mockDisconnect(params),
        ),
    forgetDeviceThunk: jest
        .requireActual('@reduxjs/toolkit')
        .createAsyncThunk('@test/forgetDevice', (params: unknown) => mockForget(params)),
}));

describe('useForgetDevice', () => {
    const renderForget = (isLedger: boolean, connected = true) => {
        const selectedDevice = {
            ...mockSuiteDevice({
                id: 'wallet-device',
                connected,
                descriptor: { apiType: isLedger ? 'bluetooth' : 'usb', id: 'transport-device' },
                unavailableCapabilities: isLedger
                    ? { 'settings.bluetoothPairing': 'no-support' as const }
                    : {},
            }),
            ...(isLedger ? { provider: 'ledger' as const } : {}),
        };

        return renderHookWithStoreProvider(useForgetDevice, {
            preloadedState: {
                device: { ...deviceReducerInitialState, selectedDevice, devices: [selectedDevice] },
            },
        });
    };

    beforeEach(() => jest.clearAllMocks());

    it('disconnects a connected Ledger, forgets it and returns home without Trezor unpairing', async () => {
        const { result } = await renderForget(true);

        await act(() => result.current.forgetDevice());

        expect(mockDisconnect).toHaveBeenCalledWith({
            device: expect.objectContaining({ provider: 'ledger' }),
        });
        expect(mockForget).toHaveBeenCalledWith({
            deviceId: 'wallet-device',
            isOsUnpairingFinished: true,
            skipDisconnect: true,
        });
        expect(mockDisconnect.mock.invocationCallOrder[0]).toBeLessThan(
            mockForget.mock.invocationCallOrder[0] ?? 0,
        );
        expect(mockUnpairBluetoothDevice).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockPopTo).toHaveBeenCalledWith(RootStackRoutes.AppTabs, expect.anything());
        expect(mockShowToast).toHaveBeenCalled();
    });

    it('forgets a remembered disconnected Ledger without opening an unplug guide', async () => {
        const { result } = await renderForget(true, false);

        await act(() => result.current.forgetDevice());

        expect(mockDisconnect).not.toHaveBeenCalled();
        expect(mockForget).toHaveBeenCalled();
        expect(mockUnpairBluetoothDevice).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockPopTo).toHaveBeenCalled();
    });

    it('preserves the connected Trezor unplug guide', async () => {
        const { result } = await renderForget(false);

        await act(() => result.current.forgetDevice());

        expect(mockNavigate).toHaveBeenCalledWith(DeviceSettingsStackRoutes.ForgetDeviceStack, {
            screen: ForgetDeviceStackRoutes.ForgetDeviceFinish,
        });
        expect(mockDisconnect).not.toHaveBeenCalled();
    });
});
