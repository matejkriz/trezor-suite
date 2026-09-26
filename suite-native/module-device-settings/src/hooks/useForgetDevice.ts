import { useSelector } from 'react-redux';

import { useNavigation } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import {
    selectDeviceSettingsCapabilities,
    selectIsDeviceConnected,
    selectIsDeviceConnectedViaBluetooth,
    selectSelectedDevice,
} from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { disconnectWalletDeviceThunk, forgetDeviceThunk } from '@suite-common/wallet-core';
import { selectIsKnownBluetoothDevice, useBluetoothDevice } from '@suite-native/bluetooth';
import { useTranslate } from '@suite-native/intl';
import {
    AppTabsRoutes,
    type DeviceSettingsStackParamList,
    DeviceSettingsStackRoutes,
    ForgetDeviceStackRoutes,
    HomeStackRoutes,
    type RootStackParamList,
    RootStackRoutes,
    type StackToStackCompositeNavigationProps,
} from '@suite-native/navigation';
import { useToast } from '@suite-native/toasts';

type NavigationProps = StackToStackCompositeNavigationProps<
    DeviceSettingsStackParamList,
    DeviceSettingsStackRoutes.ForgetDevice,
    RootStackParamList
>;

export const useForgetDevice = () => {
    const navigation = useNavigation<NavigationProps>();
    const { dispatch } = useServices(injectDispatch);

    const { showToast } = useToast();
    const { translate } = useTranslate();

    const { unpairBluetoothDevice } = useBluetoothDevice();

    const isDeviceConnectedViaBluetooth = useSelector(selectIsDeviceConnectedViaBluetooth);
    const isKnownBluetoothDevice = useSelector(selectIsKnownBluetoothDevice);
    const isDeviceConnected = useSelector(selectIsDeviceConnected);
    const selectedDevice = useSelector(selectSelectedDevice);
    const capabilities = useSelector(selectDeviceSettingsCapabilities);

    const returnToHome = () => {
        navigation.popTo(RootStackRoutes.AppTabs, {
            screen: AppTabsRoutes.HomeStack,
            params: {
                screen: HomeStackRoutes.Home,
            },
        });
        showToast({
            icon: 'check',
            intent: 'neutral',
            message: translate('moduleDeviceSettings.forgetDevice.successToast'),
        });
    };

    const forgetDeviceAndHandleNavigation = async () => {
        if (!capabilities.bluetoothPairing) {
            if (selectedDevice?.connected) {
                await dispatch(disconnectWalletDeviceThunk({ device: selectedDevice })).unwrap();
            }
            await dispatch(
                forgetDeviceThunk({
                    deviceId: selectedDevice?.id,
                    isOsUnpairingFinished: true,
                    skipDisconnect: true,
                }),
            ).unwrap();
            returnToHome();

            return;
        }

        if (isDeviceConnected) {
            dispatch(forgetDeviceThunk({ isOsUnpairingFinished: true }));
            navigation.navigate(DeviceSettingsStackRoutes.ForgetDeviceStack, {
                screen: ForgetDeviceStackRoutes.ForgetDeviceFinish,
            });
        } else {
            // Awaited to ensure the home screen is already updated.
            await dispatch(forgetDeviceThunk({ isOsUnpairingFinished: true }));
            returnToHome();
        }
    };

    const forgetDevice = () => {
        if (!capabilities.bluetoothPairing) {
            return forgetDeviceAndHandleNavigation();
        }

        if (isDeviceConnectedViaBluetooth) {
            navigation.navigate(DeviceSettingsStackRoutes.ForgetDeviceStack, {
                screen: ForgetDeviceStackRoutes.ForgetDeviceConfirmation,
            });
            unpairBluetoothDevice({
                onSuccess: () => dispatch(forgetDeviceThunk()),
                onCancel: navigation.goBack,
            });
        } else if (isKnownBluetoothDevice) {
            navigation.navigate(DeviceSettingsStackRoutes.ForgetDeviceStack, {
                screen: ForgetDeviceStackRoutes.ForgetDeviceGuide,
            });
        } else {
            forgetDeviceAndHandleNavigation();
        }
    };

    return {
        isKnownBluetoothDevice,
        forgetDevice,
        forgetDeviceAndHandleNavigation,
    };
};
