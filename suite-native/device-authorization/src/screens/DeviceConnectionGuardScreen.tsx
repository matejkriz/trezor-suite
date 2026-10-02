import { useSelector } from 'react-redux';

import { useServices } from '@suite-common/dependency-injection';
import { injectDispatch } from '@suite-common/redux-utils';
import { cancelDeviceActionThunk } from '@suite-common/wallet-core';
import {
    DeviceConnectionScreenContent,
    selectIsDeviceConnectionScrollable,
} from '@suite-native/device';
import { Screen, useNavigateToInitialScreen } from '@suite-native/navigation';

import { ConnectDeviceScreenHeader } from '../components/ConnectDeviceScreenHeader';
import { useDeviceReadyEvents } from '../hooks/useDeviceReadyEvents';
import { useOnThpPairingCanceled } from '../hooks/useOnThpPairingCanceled';

type DeviceConnectionGuardScreenParams = {
    onCancel?: () => void;
};

export const DeviceConnectionGuardScreen = ({ onCancel }: DeviceConnectionGuardScreenParams) => {
    const { emitDeviceNotReadyEvent } = useDeviceReadyEvents();
    const navigateToInitialScreen = useNavigateToInitialScreen();
    const { dispatch } = useServices(injectDispatch);

    const isScrollable = useSelector(selectIsDeviceConnectionScrollable);

    const handleCancel = () => {
        emitDeviceNotReadyEvent();
        navigateToInitialScreen();
    };

    useOnThpPairingCanceled(handleCancel);

    const defaultOnCancel = () => {
        void dispatch(cancelDeviceActionThunk({}));
        handleCancel();
    };

    return (
        <Screen
            header={<ConnectDeviceScreenHeader onCancel={onCancel ?? defaultOnCancel} />}
            isScrollable={isScrollable}
        >
            <DeviceConnectionScreenContent />
        </Screen>
    );
};
