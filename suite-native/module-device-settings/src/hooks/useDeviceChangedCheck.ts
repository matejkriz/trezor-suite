import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import { useNavigation } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedDevice } from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { cancelDeviceActionThunk } from '@suite-common/wallet-core';
import {
    AppTabsRoutes,
    type DeviceSettingsStackParamList,
    type DeviceSettingsStackRoutes,
    HomeStackRoutes,
    type RootStackParamList,
    RootStackRoutes,
    type StackToStackCompositeNavigationProps,
} from '@suite-native/navigation';

type NavigationProps = StackToStackCompositeNavigationProps<
    DeviceSettingsStackParamList,
    DeviceSettingsStackRoutes.DeviceSettings,
    RootStackParamList
>;

// When user accesses device settings in remember mode and tries to modify the device,
// he will be prompted to connect Trezor. This hook prevents usage of incorrect device.
export const useDeviceChangedCheck = () => {
    const device = useSelector(selectSelectedDevice);
    const { dispatch } = useServices(injectDispatch);
    const navigation = useNavigation<NavigationProps>();
    const initialDeviceIdRef = useRef<string | null>(null);
    // Important for device wipe. Device ID changes for wiped device, but if it was connected,
    // we know the device was wiped, thus we want to prevent the navigation call.
    const hasDeviceBeenConnected = useRef<boolean>(false);

    useEffect(() => {
        // Store the initial device ID when the component mounts
        if (initialDeviceIdRef.current === null && device?.id) {
            initialDeviceIdRef.current = device.id;
            hasDeviceBeenConnected.current = device.connected;

            return;
        }

        if (
            initialDeviceIdRef.current &&
            device?.id &&
            initialDeviceIdRef.current !== device.id &&
            !hasDeviceBeenConnected.current &&
            device.connected
        ) {
            void dispatch(cancelDeviceActionThunk({ device }));
            navigation.popTo(RootStackRoutes.AppTabs, {
                screen: AppTabsRoutes.HomeStack,
                params: {
                    screen: HomeStackRoutes.Home,
                },
            });
        }
    }, [device, dispatch, navigation]);
};
