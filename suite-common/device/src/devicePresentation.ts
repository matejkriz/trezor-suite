import {
    type DeviceInformation,
    type DeviceProvider,
    type TrezorDevice,
} from '@suite-common/suite-types';
import { type Device } from '@trezor/connect';

import { isLedgerDevice } from './ledgerDevice';

export const getDeviceProvider = (device?: Device): DeviceProvider =>
    isLedgerDevice(device) ? 'ledger' : 'trezor';

export const getDeviceBrandName = (device?: Device): string =>
    getDeviceProvider(device) === 'ledger' ? 'Ledger' : 'Trezor';

export const getDeviceInformation = (device?: TrezorDevice): DeviceInformation | undefined =>
    device?.deviceInfo ?? (isLedgerDevice(device) ? device.ledgerInfo : undefined);
