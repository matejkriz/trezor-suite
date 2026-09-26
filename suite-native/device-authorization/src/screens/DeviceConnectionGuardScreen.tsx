import { useSelector } from 'react-redux';

import { useServices } from '@suite-common/dependency-injection';
import {
    isLedgerDevice,
    selectIsBluetoothSupportedByDevice,
    selectSelectedDevice,
} from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { cancelDeviceActionThunk } from '@suite-common/wallet-core';
import { selectBluetoothPermissionStatus } from '@suite-native/bluetooth';
import {
    ConnectAndUnlockDeviceScreenContent,
    ConnectLedgerDeviceScreenContent,
    TurnOnAndUnlockDeviceScreenContent,
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

    const bluetoothPermissionStatus = useSelector(selectBluetoothPermissionStatus);
    const isBluetoothSupportedByDevice = useSelector(selectIsBluetoothSupportedByDevice);
    const selectedDevice = useSelector(selectSelectedDevice);

    const isBluetoothVariantVisible =
        bluetoothPermissionStatus === 'granted' && isBluetoothSupportedByDevice;

    const handleCancel = () => {
        emitDeviceNotReadyEvent();
        navigateToInitialScreen();
    };

    useOnThpPairingCanceled(handleCancel);

    const defaultOnCancel = () => {
        void dispatch(cancelDeviceActionThunk({}));
        handleCancel();
    };

    const trezorConnectionContent = isBluetoothVariantVisible ? (
        <TurnOnAndUnlockDeviceScreenContent />
    ) : (
        <ConnectAndUnlockDeviceScreenContent />
    );

    return (
        <Screen
            header={<ConnectDeviceScreenHeader onCancel={onCancel ?? defaultOnCancel} />}
            isScrollable={isLedgerDevice(selectedDevice)}
        >
            {isLedgerDevice(selectedDevice) ? (
                <ConnectLedgerDeviceScreenContent expectedDeviceId={selectedDevice.id} />
            ) : (
                trezorConnectionContent
            )}
        </Screen>
    );
};
