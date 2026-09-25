import { createMockDeps } from '@suite-common/dependency-injection';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import {
    type ConfirmAddressOnDeviceThunkDeps,
    confirmAddressOnDeviceThunk,
} from './device/deviceThunks';

const staticSessionId = 'ledgerwallet@ledger:0' as const;
const address = 'bc1qtestledgeraddress';
const addressPath = "m/84'/0'/0'/0/5";

const account = mockWalletAccount({
    symbol: asNetworkSymbol('btc'),
    deviceState: staticSessionId,
    path: "m/84'/0'/0'",
    index: 0,
    addresses: {
        change: [],
        used: [],
        unused: [
            { address, path: addressPath, transfers: 0, balance: '0', received: '0', sent: '0' },
        ],
    },
});

const createStore = ({ connected = true, returnedAddress = address, accountIndex = 0 } = {}) => {
    const deps = createMockDeps<ConfirmAddressOnDeviceThunkDeps>({
        services: {
            ledgerBitcoinService: {
                verifyAddress: () => Promise.resolve(returnedAddress),
            },
        },
    });
    const store = createTestStore({
        extra: deps,
        preloadedState: {
            device: {
                selectedDevice: {
                    ...mockSuiteDevice({
                        id: 'ledgerwallet',
                        connected,
                        available: connected,
                        state: { staticSessionId },
                    }),
                    provider: 'ledger',
                },
            },
            wallet: { accounts: [{ ...account, index: accountIndex }] },
        },
    });

    return { store, deps };
};

describe('confirmAddressOnDeviceThunk for Ledger', () => {
    it('confirms a receive address from the selected Ledger account', async () => {
        const { store, deps } = createStore();

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({
                accountKey: account.key,
                addressPath,
                chunkify: false,
            }),
        );

        expect(result.payload).toEqual({
            success: true,
            payload: expect.objectContaining({ address, serializedPath: addressPath }),
        });
        expect(deps.services.ledgerBitcoinService.verifyAddress).toHaveBeenCalledWith(0, 5);
    });

    it('rejects an address that differs from the backend account', async () => {
        const { store } = createStore({ returnedAddress: 'bc1qdifferent' });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
    });

    it('rejects a path outside the selected Ledger account without contacting the device', async () => {
        const { store, deps } = createStore();

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({
                accountKey: account.key,
                addressPath: "m/84'/0'/1'/0/5",
                chunkify: false,
            }),
        );

        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
        expect(deps.services.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });

    it('rejects confirmation while Ledger is disconnected', async () => {
        const { store, deps } = createStore({ connected: false });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
        expect(deps.services.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });

    it('rejects an invalid account index as a normal confirmation failure', async () => {
        const { store, deps } = createStore({ accountIndex: -1 });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.type).toBe(confirmAddressOnDeviceThunk.fulfilled.type);
        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
        expect(deps.services.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });
});
