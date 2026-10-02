import {
    DEVICE_MODULE_PREFIX,
    type DeviceRootState,
    selectSelectedDevice,
} from '@suite-common/device';
import { type WithServices, createThunk } from '@suite-common/redux-utils';
import { type TrezorDevice } from '@suite-common/suite-types';

import {
    type CancelWalletDeviceActionParams,
    type WalletDeviceServiceDep,
} from './createWalletDeviceService';

type CancelDeviceActionThunkState = DeviceRootState;

type CancelDeviceActionThunkDeps = WithServices<WalletDeviceServiceDep>;

export const cancelDeviceActionThunk = createThunk<
    void,
    CancelWalletDeviceActionParams,
    { state: CancelDeviceActionThunkState; extra: CancelDeviceActionThunkDeps }
>(`${DEVICE_MODULE_PREFIX}/cancelDeviceAction`, ({ device, reason }, { extra, getState }) =>
    extra.services.walletDeviceService.cancelAction({
        device: device ?? selectSelectedDevice(getState()),
        reason,
    }),
);

type DisconnectWalletDeviceThunkDeps = WithServices<WalletDeviceServiceDep>;

export const disconnectWalletDeviceThunk = createThunk<
    void,
    { device: TrezorDevice },
    { extra: DisconnectWalletDeviceThunkDeps }
>(`${DEVICE_MODULE_PREFIX}/disconnectWalletDevice`, ({ device }, { extra }) =>
    extra.services.walletDeviceService.disconnect(device),
);
