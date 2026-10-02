import { type CommonServices } from '@suite-common/extra-dependencies';
import { type LedgerBitcoinServiceDep } from '@suite-common/ledger';
import { type WalletDeviceServiceDep } from '@suite-common/wallet-core';
import { type NativeAnalyticsDep } from '@suite-native/analytics';
import { type MMKVStorageDep } from '@suite-native/services';

export type NativeServices = CommonServices &
    NativeAnalyticsDep &
    MMKVStorageDep &
    LedgerBitcoinServiceDep &
    WalletDeviceServiceDep;
