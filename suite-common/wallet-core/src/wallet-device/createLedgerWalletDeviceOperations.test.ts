import { createMockDeps } from '@suite-common/dependency-injection';
import { deviceActions, prepareDeviceReducer } from '@suite-common/device';
import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type FormState, type PrecomposedTransactionFinal } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import {
    type WalletDeviceServiceDeps,
    createWalletDeviceService,
} from './createWalletDeviceService';
import { createLedgerSuiteDevice } from '../ledger/createLedgerSuiteDevice';
import { signLedgerBitcoinTransaction } from '../send/signLedgerBitcoinTransaction';

jest.mock('../send/signLedgerBitcoinTransaction', () => ({
    signLedgerBitcoinTransaction: jest.fn(),
}));

const addressPath = "m/84'/0'/0'/0/0";
const address = 'bc1q-test-address';
const account = mockWalletAccount({
    symbol: asNetworkSymbol('btc'),
    accountType: 'normal',
    index: 0,
    path: "m/84'/0'/0'",
    deviceState: 'walleta@ledger:0',
    addresses: {
        used: [],
        change: [],
        unused: [
            { address, path: addressPath, transfers: 0, balance: '0', received: '0', sent: '0' },
        ],
    },
});
const signParams = {
    selectedAccount: { ...account, addresses: undefined },
    formState: {} as FormState,
    precomposedTransaction: { type: 'final' } as PrecomposedTransactionFinal,
};

const prepareTest = () => {
    let owner = 'acquisition-a';
    const device = createLedgerSuiteDevice({
        id: 'walleta',
        label: 'Test Ledger',
        staticSessionId: 'walleta@ledger:0',
        sessionId: owner,
    });
    const deps = createMockDeps<WalletDeviceServiceDeps>({
        ledgerBitcoinService: {
            isConnectionOwner: candidate => candidate === owner,
            verifyAddress: () => Promise.resolve(address),
            getAccount: () =>
                Promise.resolve({
                    path: "84'/0'/0'",
                    descriptor: 'test-descriptor',
                    extendedPublicKey: 'test-xpub',
                    masterFingerprint: '1234abcd',
                    address,
                }),
            signTransaction: () => Promise.resolve('01000000'),
            cancelAction: null,
            disconnect: null,
        },
        dispatch: action => action,
    });
    const service = createWalletDeviceService(deps);
    const operations = service.get(device);
    if (!operations) throw new Error('Missing test wallet operations');

    return {
        deps,
        device,
        operations,
        replaceConnection: () => {
            owner = 'acquisition-b';
        },
    };
};

describe('Ledger wallet operations connection ownership', () => {
    beforeEach(() => {
        jest.mocked(signLedgerBitcoinTransaction).mockImplementation(async ({ signer }) => {
            await signer.getAccount(0);

            return signer.signTransaction(0, 'test-psbt');
        });
    });

    it('refuses an old operations object after reconnecting the same wallet', async () => {
        const { operations, deps, replaceConnection } = prepareTest();
        replaceConnection();

        await expect(operations.confirmAddress({ account, addressPath })).resolves.toMatchObject({
            success: false,
            error: { code: 'Method_Cancel' },
        });
        await expect(operations.signTransaction(signParams)).rejects.toMatchObject({
            kind: 'cancelled',
        });

        expect(deps.ledgerBitcoinService.verifyAddress).not.toHaveBeenCalled();
        expect(deps.ledgerBitcoinService.getAccount).not.toHaveBeenCalled();
        expect(deps.dispatch).not.toHaveBeenCalled();
    });

    it('does not confirm an address returned by a replaced session', async () => {
        const { operations, deps, device, replaceConnection } = prepareTest();
        const deviceReducer = prepareDeviceReducer({
            actionTypes: {
                setDeviceMetadata: mockActionType('setDeviceMetadata'),
                setDeviceMetadataPasswords: mockActionType('setDeviceMetadataPasswords'),
                storageLoad: mockActionType('storageLoad'),
            },
            reducers: {
                setDeviceMetadataPasswordsReducer: mockReducer(),
                setDeviceMetadataReducer: mockReducer(),
                storageLoadDevices: mockReducer(),
            },
        });
        let state = deviceReducer(undefined, deviceActions.connectLedgerDevice(device));
        deps.dispatch.mockImplementation(action => {
            state = deviceReducer(state, action);

            return action;
        });
        let finishVerification: (value: string) => void = () => undefined;
        deps.ledgerBitcoinService.verifyAddress.mockImplementationOnce(
            () => new Promise(resolve => (finishVerification = resolve)),
        );

        const verification = operations.confirmAddress({ account, addressPath });
        replaceConnection();
        const replacementDevice = {
            ...device,
            state: { ...device.state, sessionId: 'acquisition-b' },
            buttonRequests: [],
        };
        state = deviceReducer(state, deviceActions.connectLedgerDevice(replacementDevice));
        state = deviceReducer(
            state,
            deviceActions.addButtonRequest({
                device: replacementDevice,
                buttonRequest: { code: 'ButtonRequest_Address' },
            }),
        );
        finishVerification(address);

        await expect(verification).resolves.toMatchObject({
            success: false,
            error: { code: 'Method_Cancel' },
        });
        expect(deps.dispatch.mock.calls.flat()).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: '@suite/device/removeButtonRequests' }),
            ]),
        );
        expect(state.devices[0]?.buttonRequests).toEqual([{ code: 'ButtonRequest_Address' }]);
    });

    it('does not start signing on Ledger B after Ledger A finishes account reading', async () => {
        const { operations, deps, replaceConnection } = prepareTest();
        const ledgerAccount = await deps.ledgerBitcoinService.getAccount(0);
        deps.ledgerBitcoinService.getAccount.mockClear();
        let finishAccount: (value: typeof ledgerAccount) => void = () => undefined;
        deps.ledgerBitcoinService.getAccount.mockImplementationOnce(
            () => new Promise(resolve => (finishAccount = resolve)),
        );

        const signing = operations.signTransaction(signParams);
        replaceConnection();
        finishAccount(ledgerAccount);

        await expect(signing).rejects.toMatchObject({ kind: 'cancelled' });
        expect(deps.ledgerBitcoinService.signTransaction).not.toHaveBeenCalled();
    });

    it('does not return a signed transaction after its session is replaced', async () => {
        const { operations, deps, replaceConnection } = prepareTest();
        let finishSigning: (value: string) => void = () => undefined;
        let markSigningRequested: () => void = () => undefined;
        const signingRequested = new Promise<void>(resolve => (markSigningRequested = resolve));
        deps.ledgerBitcoinService.signTransaction.mockImplementationOnce(() => {
            markSigningRequested();

            return new Promise(resolve => (finishSigning = resolve));
        });

        const signing = operations.signTransaction(signParams);
        await signingRequested;
        replaceConnection();
        finishSigning('01000000');

        await expect(signing).rejects.toMatchObject({ kind: 'cancelled' });
    });
});
