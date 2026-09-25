import { combineReducers } from '@reduxjs/toolkit';

import { deviceInitialState, selectSelectedDevice } from '@suite-common/device';
import { createThunk } from '@suite-common/redux-utils';
import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { mockOpenModal, mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import {
    confirmAddressOnDeviceThunk,
    prepareWalletSettingsReducer,
} from '@suite-common/wallet-core';
import { type Account, createAccountKey } from '@suite-common/wallet-types';

import type { LogErrorThunkProps } from './logErrorThunk';
import { accounts } from '../../reducers/__fixtures__/account';
import { initialState } from '../../reducers/tradingCommonReducer';
import { prepareTradingReducer } from '../../reducers/tradingReducer';

import { tradingThunks } from './index';

const tradingReducer = prepareTradingReducer({
    actionTypes: { storageLoad: mockActionType('storageLoad') },
});
const walletSettingsReducer = prepareWalletSettingsReducer({
    actionTypes: { storageLoad: mockActionType('storageLoad') },
    reducers: { storageLoadWalletSettings: mockReducer() },
});
const verifyAddressThunkDeps = {
    actions: {
        openModal: mockOpenModal(),
    },
};

const createMockStore = (deviceState = deviceInitialState, accountState = accounts) =>
    createTestStore({
        extra: verifyAddressThunkDeps,
        reducer: combineReducers({
            device: () => deviceState,
            wallet: combineReducers({
                accounts: () => accountState,
                settings: walletSettingsReducer,
                trading: tradingReducer,
            }),
        }),
        preloadedState: {
            wallet: {
                trading: initialState,
            },
        },
    });

jest.mock('@suite-common/device', () => ({
    ...jest.requireActual('@suite-common/device'),
    selectSelectedDevice: jest.fn(),
}));

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    confirmAddressOnDeviceThunk: jest.fn(),
}));

jest.mock('../common/logErrorThunk', () => ({
    logErrorThunk: (props: LogErrorThunkProps) => ({
        type: 'mockedLogErrorThunk',
        payload: props,
    }),
}));

describe('verifyAddressThunk', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('verifies a Bitcoin address when the selected Ledger is connected', async () => {
        const staticSessionId = 'ledgerwallet@ledger:0';
        const originalAccount = accounts[0];
        if (!originalAccount) throw new Error('Missing test fixture');
        const account: Account = {
            ...originalAccount,
            deviceState: staticSessionId,
            key: createAccountKey({
                accountDescriptor: originalAccount.descriptor,
                networkSymbol: originalAccount.symbol,
                deviceStaticSessionId: staticSessionId,
            }),
        };
        const ledgerDevice = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                connected: true,
                available: true,
                state: { staticSessionId },
            }),
            provider: 'ledger' as const,
        };
        const store = createMockStore(
            {
                ...deviceInitialState,
                selectedDevice: ledgerDevice,
            },
            [account],
        );
        const firstUnused = account.addresses?.unused[0];
        if (!firstUnused) throw new Error('Missing Bitcoin receive address fixture');

        (selectSelectedDevice as jest.Mock).mockReturnValue(ledgerDevice);
        (confirmAddressOnDeviceThunk as unknown as jest.Mock).mockImplementation(
            createThunk('@suite/device/confirmAddressOnDeviceThunk', () => ({
                success: true,
                payload: { address: firstUnused.address, path: firstUnused.path },
            })),
        );

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: firstUnused.address,
                path: firstUnused.path,
            }),
        );

        expect(confirmAddressOnDeviceThunk).toHaveBeenCalledWith(
            expect.objectContaining({ accountKey: account.key, addressPath: firstUnused.path }),
        );
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(
            expect.objectContaining({ address: firstUnused.address }),
        );
    });

    it('should save verified address', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];
        const verifiedAddress = {
            address: addressData?.address,
            mac: 'mockedMac',
            path: "m/84'/0'/0'/0/5",
        };

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: true,
            available: true,
            useEmptyPassphrase: true,
        }));

        (confirmAddressOnDeviceThunk as unknown as jest.Mock).mockImplementation(
            createThunk('@suite/device/confirmAddressOnDeviceThunk', () => ({
                success: true,
                payload: verifiedAddress,
            })),
        );

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        expect(store.getActions().length).toEqual(7);
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(verifiedAddress);
    });

    it('should not update verified address device not found', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];

        (selectSelectedDevice as jest.Mock).mockImplementation(() => undefined);

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        expect(store.getActions().length).toEqual(2);
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });

    it('should not update verified address when path or address are not defined', async () => {
        const store = createMockStore();

        const account = {
            ...accounts[0],
            addresses: {
                unused: [],
            },
        } as unknown as Account;
        const addressData = undefined;

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: true,
            available: true,
            useEmptyPassphrase: true,
        }));

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData,
                path: addressData,
            }),
        );

        expect(store.getActions().length).toEqual(2);
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });

    it('should not update verified address, but trigger toast when device is not available', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: true,
            available: false,
            useEmptyPassphrase: true,
        }));

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        const actionModal = store.getActions().find(action => action.type === mockOpenModal().type);

        expect(actionModal).toEqual({
            type: mockOpenModal().type,
            payload: {
                type: 'unverified-address-proceed',
                value: addressData?.address,
            },
        });
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });

    it('should not update verified address, but trigger toast when device is not connected', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: false,
            available: true,
            useEmptyPassphrase: true,
        }));

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        const actionModal = store.getActions().find(action => action.type === mockOpenModal().type);

        expect(actionModal).toEqual({
            type: mockOpenModal().type,
            payload: {
                type: 'unverified-address-proceed',
                value: addressData?.address,
            },
        });
        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });

    it('should not update verified address when a confirmation of address on device is not successful (no permission)', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: true,
            available: true,
            useEmptyPassphrase: true,
        }));

        (confirmAddressOnDeviceThunk as unknown as jest.Mock).mockImplementation(
            createThunk('@suite/device/confirmAddressOnDeviceThunk', () => ({
                success: false,
                error: {
                    code: 'Method_PermissionsNotGranted',
                },
            })),
        );

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });

    it('should not update verified address when a confirmation of address on device is not successful', async () => {
        const store = createMockStore();

        const account = accounts[0];
        if (!account) throw new Error('Missing test fixture');
        const addressData = account.addresses?.unused[0];

        (selectSelectedDevice as jest.Mock).mockImplementation(() => ({
            connected: true,
            available: true,
            useEmptyPassphrase: true,
        }));

        const error = 'error message';
        (confirmAddressOnDeviceThunk as unknown as jest.Mock).mockImplementation(
            createThunk('@suite/device/confirmAddressOnDeviceThunk', () => ({
                success: false,
                error: {
                    message: error,
                    code: 'error-code',
                },
            })),
        );

        await store.dispatch(
            tradingThunks.verifyAddressThunk({
                account,
                address: addressData?.address,
                path: addressData?.path,
            }),
        );

        const actionToast = store
            .getActions()
            .find(action => action.type === 'mockedLogErrorThunk');

        expect(actionToast).toEqual({
            type: 'mockedLogErrorThunk',
            payload: {
                tradingType: 'buy',
                toastType: 'verify-address-error',
                errorMessage: error,
            },
        });

        expect(store.getState().wallet.trading.verifiedAddress).toEqual(undefined);
    });
});
