import { type Account } from '@suite-common/wallet-types';

import {
    type WalletDeviceAccountCapabilities,
    type WalletDeviceOperations,
} from './walletDeviceTypes';

export const getWalletDeviceAccountCapabilities = (
    operations: WalletDeviceOperations | undefined,
    account: Account | null | undefined,
): WalletDeviceAccountCapabilities => {
    if (!account) return { canSignTransaction: false, canConfirmAddress: false };

    return (
        operations?.getAccountCapabilities?.(account) ?? {
            canSignTransaction: true,
            canConfirmAddress: true,
        }
    );
};
