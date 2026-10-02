import { useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import { type RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import { selectDeviceBrandName } from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { cancelDeviceActionThunk } from '@suite-common/wallet-core';
import {
    ContinueOnTrezorScreenContent,
    DeviceInteractionScreenWrapper,
} from '@suite-native/device';
import {
    ReceiveAddressVerificationSource,
    type ReceiveAddressVerificationStackParamList,
    type ReceiveAddressVerificationStackRoutes,
    useInterceptNativeNavigation,
} from '@suite-native/navigation';
import { exhaustive } from '@trezor/type-utils';

import { useReceiveAddressVerification } from '../hooks/useReceiveAddressVerification';

const getTitleTxKey = (source: ReceiveAddressVerificationSource, deviceName: string) => {
    switch (source) {
        case ReceiveAddressVerificationSource.Pasted:
            return deviceName === 'Trezor'
                ? 'moduleReceive.addressVerificationScreen.pastedTitle'
                : 'moduleReceive.addressVerificationScreen.pastedDeviceTitle';
        case ReceiveAddressVerificationSource.Shared:
            return deviceName === 'Trezor'
                ? 'moduleReceive.addressVerificationScreen.sharedTitle'
                : 'moduleReceive.addressVerificationScreen.sharedDeviceTitle';
        case ReceiveAddressVerificationSource.Verified:
            return deviceName === 'Trezor'
                ? 'moduleReceive.addressVerificationScreen.verifiedTitle'
                : 'moduleReceive.addressVerificationScreen.verifiedDeviceTitle';
        default:
            return exhaustive(source);
    }
};

export const ReceiveAddressVerificationScreen = () => {
    const {
        params: { accountKey, addressPath, source },
    } =
        useRoute<
            RouteProp<
                ReceiveAddressVerificationStackParamList,
                ReceiveAddressVerificationStackRoutes.ContinueOnTrezor
            >
        >();
    const { verifyAddressOnDevice } = useReceiveAddressVerification(accountKey, addressPath);
    const { dispatch } = useServices(injectDispatch);
    const deviceName = useSelector(selectDeviceBrandName);
    const hasStartedVerificationRef = useRef(false);

    // This screen becomes focused only after the connection guard is cleared. Start verification
    // here and guard against focus returning after device authorization.
    useFocusEffect(
        useCallback(() => {
            if (hasStartedVerificationRef.current) {
                return;
            }

            hasStartedVerificationRef.current = true;
            void verifyAddressOnDevice();
        }, [verifyAddressOnDevice]),
    );

    const handleCancel = useCallback(() => {
        void dispatch(cancelDeviceActionThunk({}));
    }, [dispatch]);

    useInterceptNativeNavigation({ onPress: handleCancel });

    return (
        <DeviceInteractionScreenWrapper>
            <ContinueOnTrezorScreenContent titleTxKey={getTitleTxKey(source, deviceName)} />
        </DeviceInteractionScreenWrapper>
    );
};
