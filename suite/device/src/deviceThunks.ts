import { type LocksRootState, selectIsDeviceLocked } from '@suite/locks';
import {
    type DeviceRootState,
    getDeviceOperationCapabilities,
    getDeviceProvider,
    selectSelectedDevice,
} from '@suite-common/device';
import { createThunk } from '@suite-common/redux-utils';
import { type TrezorDevice } from '@suite-common/suite-types';
import TrezorConnect from '@trezor/connect';

import { openConnectionModal, setConnectionMode } from './deviceSlice';

const DEVICE_MODULE_PREFIX = '@suite';

export const openDeviceConnectionThunk = createThunk<void, TrezorDevice | undefined, void>(
    `${DEVICE_MODULE_PREFIX}/openDeviceConnection`,
    (device, { dispatch }) => {
        dispatch(
            setConnectionMode(device?.descriptor?.apiType === 'bluetooth' ? 'bluetooth' : 'cable'),
        );
        dispatch(openConnectionModal(getDeviceProvider(device)));
    },
);

/**
 * Connect call to rerun FW authenticity checks (getFeatures used as the most basic no-op device call).
 */
type RerunFwAuthenticityChecksThunkState = DeviceRootState & LocksRootState;

export const rerunFwAuthenticityChecksThunk = createThunk<
    void,
    void,
    { state: RerunFwAuthenticityChecksThunkState }
>(`${DEVICE_MODULE_PREFIX}/rerunFwAuthenticityChecksThunk`, (_, { getState }) => {
    const device = selectSelectedDevice(getState());
    if (device === undefined || !getDeviceOperationCapabilities(device).firmwareChecks) return;
    if (selectIsDeviceLocked(getState())) return;
    void TrezorConnect.getFeatures({ device: { path: device.path } });
});
