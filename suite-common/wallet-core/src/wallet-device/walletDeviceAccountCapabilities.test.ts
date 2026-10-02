import { createMockDeps } from '@suite-common/dependency-injection';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { type WalletDeviceOperations } from './createWalletDeviceService';
import { getWalletDeviceAccountCapabilities } from './walletDeviceAccountCapabilities';

const account = mockWalletAccount({ symbol: asNetworkSymbol('btc') });

describe(getWalletDeviceAccountCapabilities.name, () => {
    it('preserves Trezor defaults and operations implementations without capability overrides', () => {
        const operations = createMockDeps<WalletDeviceOperations>({
            discoverAccounts: null,
            confirmAddress: null,
            signTransaction: null,
        });

        expect(getWalletDeviceAccountCapabilities(undefined, account)).toEqual({
            canSignTransaction: true,
            canConfirmAddress: true,
        });
        expect(getWalletDeviceAccountCapabilities(operations, account)).toEqual({
            canSignTransaction: true,
            canConfirmAddress: true,
        });
    });

    it.each([undefined, null])(
        'disables operations when there is no account (%s) without calling a vendor implementation',
        emptyAccount => {
            const operations = createMockDeps<WalletDeviceOperations>({
                discoverAccounts: null,
                confirmAddress: null,
                signTransaction: null,
                getAccountCapabilities: () => ({
                    canSignTransaction: true,
                    canConfirmAddress: true,
                }),
            });

            expect(getWalletDeviceAccountCapabilities(operations, emptyAccount)).toEqual({
                canSignTransaction: false,
                canConfirmAddress: false,
            });
            expect(operations.getAccountCapabilities).not.toHaveBeenCalled();
        },
    );

    it('uses the injected operations capabilities without inspecting device vendors', () => {
        const operations = createMockDeps<WalletDeviceOperations>({
            discoverAccounts: null,
            confirmAddress: null,
            signTransaction: null,
            getAccountCapabilities: () => ({ canSignTransaction: false, canConfirmAddress: true }),
        });

        expect(getWalletDeviceAccountCapabilities(operations, account)).toEqual({
            canSignTransaction: false,
            canConfirmAddress: true,
        });
        expect(operations.getAccountCapabilities).toHaveBeenCalledWith(account);
    });
});
