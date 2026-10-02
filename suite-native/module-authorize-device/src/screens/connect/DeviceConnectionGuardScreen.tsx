import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { useFocusEffect } from '@react-navigation/native';

import { selectIsDeviceAuthorized, selectIsDeviceConnected } from '@suite-common/device';
import {
    DeviceConnectionScreenContent,
    selectIsDeviceConnectionScrollable,
} from '@suite-native/device';
import { ConnectDeviceScreenHeader } from '@suite-native/device-authorization';
import {
    type AuthorizeDeviceStackParamList,
    type AuthorizeDeviceStackRoutes,
    type RootStackParamList,
    Screen,
    type StackToStackCompositeScreenProps,
} from '@suite-native/navigation';

export const DeviceConnectionGuardScreen = ({
    navigation,
    route: { params },
}: StackToStackCompositeScreenProps<
    AuthorizeDeviceStackParamList,
    AuthorizeDeviceStackRoutes.DeviceConnectionGuard,
    RootStackParamList
>) => {
    const isDeviceConnected = useSelector(selectIsDeviceConnected);
    const isDeviceAuthorized = useSelector(selectIsDeviceAuthorized);
    const isScrollable = useSelector(selectIsDeviceConnectionScrollable);

    useFocusEffect(
        useCallback(() => {
            if (isDeviceConnected && isDeviceAuthorized) {
                navigation.goBack();
            }
        }, [isDeviceConnected, isDeviceAuthorized, navigation]),
    );

    return (
        <Screen
            header={
                <ConnectDeviceScreenHeader
                    onCancelNavigationTarget={params?.onCancelNavigationTarget}
                />
            }
            isScrollable={isScrollable}
        >
            <DeviceConnectionScreenContent />
        </Screen>
    );
};
