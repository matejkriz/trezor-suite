import { createMockDeps } from '@suite-common/dependency-injection';
import { LedgerActionError } from '@suite-common/ledger';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import TrezorConnect from '@trezor/connect';

import { confirmAddressOnDeviceThunk } from './device/deviceThunks';
import {
    type LedgerWalletDeviceOperationsDeps,
    createLedgerWalletDeviceOperationsFactory,
} from './wallet-device/createLedgerWalletDeviceOperations';
import { createWalletDeviceService } from './wallet-device/createWalletDeviceService';

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
    const deps = createMockDeps<LedgerWalletDeviceOperationsDeps>({
        ledgerBitcoinService: {
            getDeviceInfo: null,
            openAccountsDiscovery: null,
            isConnectionOwner: () => true,
            verifyAddress: () => Promise.resolve(returnedAddress),
            getAccount: null,
            signTransaction: null,
            cancelAction: null,
            disconnect: null,
        },
        dispatch: action => action,
    });
    const store = createTestStore({
        extra: {
            services: {
                walletDeviceService: createWalletDeviceService({
                    getOperations: createLedgerWalletDeviceOperationsFactory(deps),
                    cancelTrezorAction: reason => TrezorConnect.cancel(reason),
                }),
            },
        },
        preloadedState: {
            device: {
                selectedDevice: {
                    ...mockSuiteDevice({
                        id: 'ledgerwallet',
                        connected,
                        available: connected,
                        state: { staticSessionId, sessionId: 'acquisition-a' },
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
        expect(deps.ledgerBitcoinService.verifyAddress).toHaveBeenCalledWith(0, 5);
    });

    it('rejects an address that differs from the backend account', async () => {
        const { store } = createStore({ returnedAddress: 'bc1qdifferent' });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
    });

    it.each([
        ['cancelled', 'Method_Cancel'],
        ['timeout', 'Method_Cancel'],
        ['rejected', 'Failure_ActionCancelled'],
    ] as const)('preserves %s semantics for the common native receive flow', async (kind, code) => {
        const { store, deps } = createStore();
        deps.ledgerBitcoinService.verifyAddress.mockRejectedValueOnce(new LedgerActionError(kind));

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.payload).toEqual({
            success: false,
            error: { code, message: 'Device address verification canceled.' },
        });
        expect(deps.dispatch.mock.calls.flat()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: '@suite/device/removeButtonRequests' }),
            ]),
        );
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
        expect(deps.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });

    it('rejects confirmation while Ledger is disconnected', async () => {
        const { store, deps } = createStore({ connected: false });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
        expect(deps.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });

    it('rejects an invalid account index as a normal confirmation failure', async () => {
        const { store, deps } = createStore({ accountIndex: -1 });

        const result = await store.dispatch(
            confirmAddressOnDeviceThunk({ accountKey: account.key, addressPath, chunkify: false }),
        );

        expect(result.type).toBe(confirmAddressOnDeviceThunk.fulfilled.type);
        expect(result.payload).toEqual({ success: false, error: expect.any(Object) });
        expect(deps.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
    });
});
