import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import {
    type Account,
    type FormState,
    type PrecomposedTransactionFinal,
} from '@suite-common/wallet-types';
import TrezorConnect from '@trezor/connect';

import { signTransactionThunk } from './sendFormThunks';
import { signLedgerBitcoinTransaction } from './signLedgerBitcoinTransaction';

jest.mock('./signLedgerBitcoinTransaction', () => ({
    signLedgerBitcoinTransaction: jest.fn().mockResolvedValue('01000000'),
}));

const account = {
    symbol: 'btc',
    networkType: 'bitcoin',
    deviceState: 'ledger-id@ledger:0',
    accountType: 'normal',
} as unknown as Account;
const transaction = { type: 'final' } as PrecomposedTransactionFinal;
const formState = {} as FormState;

const createStore = () => {
    const ledgerBitcoinService = {
        getAccount: jest.fn(),
        signTransaction: jest.fn(),
    };
    const store = createTestStore({
        extra: { services: { ledgerBitcoinService } },
        preloadedState: {
            device: {
                selectedDevice: {
                    ...mockSuiteDevice({
                        id: 'ledger-id',
                        connected: true,
                        available: true,
                        state: { staticSessionId: 'ledger-id@ledger:0' },
                    }),
                    provider: 'ledger',
                },
            },
        },
    });

    return { store, ledgerBitcoinService };
};

describe(signTransactionThunk.name, () => {
    beforeEach(() => jest.clearAllMocks());

    it('signs selected Ledger Bitcoin account without a Trezor device', async () => {
        const { store, ledgerBitcoinService } = createStore();
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
            signer: ledgerBitcoinService,
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
});
