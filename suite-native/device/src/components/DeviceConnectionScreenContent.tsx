import { useSelector } from 'react-redux';

import {
    selectDeviceProvider,
    selectIsBluetoothSupportedByDevice,
    selectSelectedDevice,
} from '@suite-common/device';
import { selectBluetoothPermissionStatus } from '@suite-native/bluetooth';

import { ConnectAndUnlockDeviceScreenContent } from './ConnectAndUnlockDeviceScreenContent';
import { ConnectLedgerDeviceScreenContent } from './ConnectLedgerDeviceScreenContent';
import { TurnOnAndUnlockDeviceScreenContent } from './TurnOnAndUnlockDeviceScreenContent';

export const DeviceConnectionScreenContent = () => {
    const device = useSelector(selectSelectedDevice);
    const provider = useSelector(selectDeviceProvider);
    const bluetoothPermissionStatus = useSelector(selectBluetoothPermissionStatus);
    const supportsBluetooth = useSelector(selectIsBluetoothSupportedByDevice);

    if (provider === 'ledger') {
        return <ConnectLedgerDeviceScreenContent expectedDeviceId={device?.id ?? undefined} />;
    }

    return bluetoothPermissionStatus === 'granted' && supportsBluetooth ? (
        <TurnOnAndUnlockDeviceScreenContent />
    ) : (
        <ConnectAndUnlockDeviceScreenContent />
    );
};
