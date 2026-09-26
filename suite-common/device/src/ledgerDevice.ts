import { type AcquiredDevice } from '@suite-common/suite-types';
import { type Device, type StaticSessionId } from '@trezor/connect';

export type LedgerSuiteDevice = Omit<AcquiredDevice, 'id' | 'state'> & {
    provider: 'ledger';
    id: string;
    state: NonNullable<AcquiredDevice['state']> & { staticSessionId: StaticSessionId };
    ledgerInfo?: {
        model: string;
        osVersion?: string;
        bitcoinAppVersion?: string;
        batteryLevel?: number;
        accountsDiscoveryAppVersion?: string;
    };
};

export const isLedgerDevice = (device?: Device | null): device is LedgerSuiteDevice =>
    device?.type === 'acquired' && 'provider' in device && device.provider === 'ledger';
