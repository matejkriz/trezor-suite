import { type DeviceInformation, type TrezorDeviceWithState } from '@suite-common/suite-types';
import { type Device } from '@trezor/connect';

export type LedgerSuiteDevice = TrezorDeviceWithState & {
    provider: 'ledger';
    // Compatibility with devices persisted by earlier Ledger POC versions.
    ledgerInfo?: DeviceInformation;
};

export const isLedgerDevice = (device?: Device | null): device is LedgerSuiteDevice =>
    device?.type === 'acquired' && 'provider' in device && device.provider === 'ledger';
