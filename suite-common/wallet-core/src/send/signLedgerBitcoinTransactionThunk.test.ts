import { createAction } from '@reduxjs/toolkit';

import { createMockDeps } from '@suite-common/dependency-injection';
import { LedgerActionError } from '@suite-common/ledger';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import {
    type Account,
    type FormState,
    type PrecomposedTransactionFinal,
} from '@suite-common/wallet-types';
import TrezorConnect from '@trezor/connect';

import { initialState as sendFormReducerInitialState } from './sendFormReducer';
import { cancelSignSendFormTransactionThunk, signTransactionThunk } from './sendFormThunks';
import { signLedgerBitcoinTransaction } from './signLedgerBitcoinTransaction';
import {
    type WalletDeviceServiceDeps,
    createWalletDeviceService,
} from '../wallet-device/createWalletDeviceService';

jest.mock('./signLedgerBitcoinTransaction', () => ({
    signLedgerBitcoinTransaction: jest.fn().mockResolvedValue('01000000'),
}));

const account = {
    symbol: 'btc',
    networkType: 'bitcoin',
    deviceState: 'ledger-id@ledger:0',
    accountType: 'normal',
    index: 0,
    path: "m/84'/0'/0'",
} as unknown as Account;
const transaction = { type: 'final' } as PrecomposedTransactionFinal;
const formState = {} as FormState;

const createStore = () => {
    const deps = createMockDeps<WalletDeviceServiceDeps>({
        ledgerBitcoinService: {
            getDeviceInfo: null,
            openAccountsDiscovery: null,
            isConnectionOwner: () => true,
            getAccount: null,
            signTransaction: null,
            verifyAddress: null,
            cancelAction: null,
            disconnect: null,
        },
        dispatch: action => action,
    });
    const { ledgerBitcoinService } = deps;
    const store = createTestStore({
        extra: {
            services: { walletDeviceService: createWalletDeviceService(deps) },
            actions: { onModalCancel: createAction('test/modalCancel') },
        },
        preloadedState: {
            wallet: { send: sendFormReducerInitialState },
            device: {
                selectedDevice: {
                    ...mockSuiteDevice({
                        id: 'ledger-id',
                        connected: true,
                        available: true,
                        state: {
                            staticSessionId: 'ledger-id@ledger:0',
                            sessionId: 'acquisition-a',
                        },
                    }),
                    provider: 'ledger',
                },
            },
        },
    });

    return { store, ledgerBitcoinService, deps };
};

describe(signTransactionThunk.name, () => {
    beforeEach(() => jest.clearAllMocks());

    it('signs selected Ledger Bitcoin account without a Trezor device', async () => {
        const { store } = createStore();
        const trezorSign = jest.spyOn(TrezorConnect, 'signTransaction');

        const result = await store.dispatch(
            signTransactionThunk({
                formState,
                precomposedTransaction: transaction,
                selectedAccount: account,
            }),
        );

        expect(result.type).toContain('/fulfilled');
        expect(signLedgerBitcoinTransaction).toHaveBeenCalledWith({
            account,
            transaction,
            signer: {
                getAccount: expect.any(Function),
                signTransaction: expect.any(Function),
            },
            locktime: undefined,
        });
        expect(trezorSign).not.toHaveBeenCalled();
        expect(store.getActions()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    payload: expect.objectContaining({
                        serializedTx: { tx: '01000000', symbol: 'btc' },
                    }),
                }),
            ]),
        );

        trezorSign.mockRestore();
    });

    it('rejects signing an account from another wallet', async () => {
        const { store } = createStore();

        const result = await store.dispatch(
            signTransactionThunk({
                formState,
                precomposedTransaction: transaction,
                selectedAccount: { ...account, deviceState: 'other@ledger:0' },
            }),
        );

        expect(result.type).toContain('/rejected');
        expect(signLedgerBitcoinTransaction).not.toHaveBeenCalled();
    });

    it.each(['cancelled', 'rejected', 'timeout'] as const)(
        'preserves %s semantics without retaining SDK error details',
        async kind => {
            const { store, deps } = createStore();
            jest.mocked(signLedgerBitcoinTransaction).mockRejectedValueOnce(
                new LedgerActionError(kind),
            );

            const result = await store.dispatch(
                signTransactionThunk({
                    formState,
                    precomposedTransaction: transaction,
                    selectedAccount: account,
                }),
            );

            expect(result.payload).toEqual(
                kind === 'timeout'
                    ? {
                          error: 'sign-transaction-timeout',
                          message: 'Signing process timed out.',
                      }
                    : {
                          error: 'sign-transaction-failed',
                          errorCode:
                              kind === 'rejected' ? 'Failure_ActionCancelled' : 'Method_Cancel',
                          message: 'User canceled the signing process.',
                      },
            );
            expect(deps.dispatch.mock.calls.flat()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: '@suite/device/removeButtonRequests' }),
                ]),
            );
        },
    );

    it('cancels an unsigned Ledger transaction using the device service', async () => {
        const { store, ledgerBitcoinService } = createStore();
        ledgerBitcoinService.cancelAction.mockImplementation(() => undefined);

        const result = await store.dispatch(cancelSignSendFormTransactionThunk());

        expect(result.type).toContain('/fulfilled');
        expect(ledgerBitcoinService.cancelAction).toHaveBeenCalledWith('cancelled');
    });

    it('returns the common pending transaction shape for native review and clears the request', async () => {
        const { store, deps } = createStore();
        const serializedTx =
            '01000000016d20f69067ad1ffd50ee7c0f377dde2c932ccb03e84b5659732da99c20f1f650010000006b483045022100a200ea1278c3d32251a63c56f5f0861f48167c61d84de8d951eac1204856ccd402201fc03f446557bcbcef1e473616bb7bddc96561b656b7ddd6b419501543ed5044012102a7a079c1ef9916b289c2ff21a992c808d0de3dfcf8a9f163205c5c9e21f55d5cffffffff0110270000000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000';
        jest.mocked(signLedgerBitcoinTransaction).mockResolvedValueOnce(serializedTx);

        const result = await store.dispatch(
            signTransactionThunk({
                formState,
                precomposedTransaction: { ...transaction, inputs: [], outputs: [] },
                selectedAccount: {
                    ...account,
                    addresses: { used: [], unused: [], change: [] },
                },
            }),
        );

        expect(result.payload).toEqual({
            serializedTx,
            signedTx: expect.objectContaining({ hex: serializedTx, confirmations: 0 }),
        });
        expect(deps.dispatch.mock.calls.flat()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: '@suite/device/addButtonRequest',
                    payload: expect.objectContaining({
                        buttonRequest: { code: 'ButtonRequest_ConfirmOutput' },
                    }),
                }),
                expect.objectContaining({ type: '@suite/device/removeButtonRequests' }),
            ]),
        );
    });
});
