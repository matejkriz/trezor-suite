import { createMockDeps } from '@suite-common/dependency-injection';
import { deviceInitialState } from '@suite-common/device';
import { createMockDispatch } from '@suite-common/redux-utils/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import TrezorConnect from '@trezor/connect';

import {
    type ActivateStellarTokenThunkDeps,
    type ActivateStellarTokenThunkState,
    type TokenThunkPayload,
    activateStellarTokenThunk,
    deactivateStellarTokenThunk,
} from './stellarTokenThunks';
import { createLedgerSuiteDevice } from '../ledger/createLedgerSuiteDevice';

const stellarAddress = 'GDLVVGABQKYQVN6VJP7NHSLEA45A5YLS6PNKMIZFV4BBU2HXA5IRVHUR';

const prepareTest = () => {
    const ledger = createLedgerSuiteDevice({
        id: 'ledger-wallet',
        label: 'Test Ledger',
        staticSessionId: 'ledgerwallet@ledger:0',
        sessionId: 'ledger-acquisition',
    });
    const trezor = mockSuiteDevice({
        path: 'trezor-device',
        connected: true,
        state: { staticSessionId: 'trezorwallet@device:0', sessionId: 'trezor-session' },
    });
    const ledgerSession = ledger.state?.staticSessionId;
    const trezorSession = trezor.state?.staticSessionId;
    if (!ledgerSession || !trezorSession) throw new Error('Expected fixture device sessions');
    const account = mockWalletAccount({
        symbol: asNetworkSymbol('xlm'),
        descriptor: asAccountDescriptor(stellarAddress),
        path: "m/44'/148'/0'",
        deviceState: ledgerSession,
    });
    const extra = createMockDeps<ActivateStellarTokenThunkDeps>({
        services: {
            walletDeviceService: {
                get: () => ({
                    getAccountCapabilities: () => ({
                        canSignTransaction: false,
                        canConfirmAddress: false,
                    }),
                    confirmAddress: () => Promise.reject(new Error('Unexpected address request')),
                    signTransaction: () =>
                        Promise.reject(new Error('Unexpected transaction request')),
                }),
                cancelAction: null,
                disconnect: null,
            },
        },
    });
    const state: ActivateStellarTokenThunkState = {
        device: { ...deviceInitialState, devices: [ledger, trezor], selectedDevice: trezor },
        wallet: {
            fees: {
                xlm: {
                    status: 'loaded',
                    data: {
                        blockHeight: 0,
                        blockTime: 5,
                        minFee: 0,
                        maxFee: 0,
                        minPriorityFee: 0,
                        levels: [{ label: 'normal', feePerUnit: '100', blocks: -1 }],
                    },
                },
            },
        },
    };
    const payload: TokenThunkPayload = {
        account,
        contractAddress: `TEST-${stellarAddress}`,
        selectedFee: 'normal',
    };
    const { dispatch } = createMockDispatch({ getState: () => state, extra });

    return { extra, state, payload, dispatch, ledger, trezor, trezorSession };
};

describe('Stellar token signing capabilities', () => {
    beforeEach(() => {
        jest.spyOn(TrezorConnect, 'stellarSignTransaction').mockResolvedValue({
            success: false,
            error: { message: 'Rejected on device', code: 'Failure_ActionCancelled' },
        });
        jest.spyOn(TrezorConnect, 'pushTransaction').mockRejectedValue(
            new Error('Unexpected broadcast'),
        );
    });
    afterEach(() => jest.restoreAllMocks());

    it.each([activateStellarTokenThunk, deactivateStellarTokenThunk])(
        'rejects token management for an unsupported account using its owning device',
        async thunk => {
            const { extra, payload, dispatch, ledger } = prepareTest();

            const result = await dispatch(thunk(payload));

            expect(result.meta.requestStatus).toBe('rejected');
            expect(result.payload).toEqual({
                error: 'sign-transaction-failed',
                message: 'Account transaction signing is not supported by this device.',
            });
            expect(extra.services.walletDeviceService.get).toHaveBeenCalledWith(ledger);
            expect(TrezorConnect.stellarSignTransaction).not.toHaveBeenCalled();
            expect(TrezorConnect.pushTransaction).not.toHaveBeenCalled();
        },
    );

    it('retains Trezor signing and its existing rejection message for the account owning device', async () => {
        const { extra, state, payload, dispatch, ledger, trezor, trezorSession } = prepareTest();
        state.device.selectedDevice = ledger;
        payload.account = { ...payload.account, deviceState: trezorSession };
        extra.services.walletDeviceService.get.mockReturnValue(undefined);

        const result = await dispatch(activateStellarTokenThunk(payload));

        expect(result.payload).toEqual({
            error: 'sign-transaction-failed',
            message: 'Rejected on device',
        });
        expect(extra.services.walletDeviceService.get).toHaveBeenCalledWith(trezor);
        expect(TrezorConnect.stellarSignTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ device: expect.objectContaining({ path: trezor.path }) }),
        );
        expect(TrezorConnect.pushTransaction).not.toHaveBeenCalled();
    });

    it('refuses an account without its associated device instead of using another selected wallet', async () => {
        const { extra, state, payload, dispatch, trezor } = prepareTest();
        state.device.devices = [trezor];

        const result = await dispatch(activateStellarTokenThunk(payload));

        expect(result.payload).toEqual({
            error: 'sign-transaction-failed',
            message: 'Invalid input data.',
        });
        expect(extra.services.walletDeviceService.get).not.toHaveBeenCalled();
        expect(TrezorConnect.stellarSignTransaction).not.toHaveBeenCalled();
    });
});
