import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';

import { DEVICE_MODULE_PREFIX } from './deviceConstants';
import { deviceReducerInitialState, prepareDeviceReducer } from './deviceReducer';

const reducer = prepareDeviceReducer({
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

const wallet = {
    id: 'wallet-1',
    provider: 'ledger',
    label: 'Ledger Flex',
    staticSessionId: 'ledger@wallet1',
    connected: true,
};

describe('external wallet selection', () => {
    it('adds a connected Ledger wallet and selects it without a Trezor device', () => {
        const state = reducer(deviceReducerInitialState, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: wallet,
        });

        expect(state.externalWallets).toEqual([wallet]);
        expect(state.selectedExternalWalletId).toBe(wallet.id);
        expect(state.selectedDevice).toBeUndefined();
    });

    it('keeps one entry when the same Ledger reconnects', () => {
        const connected = reducer(deviceReducerInitialState, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: wallet,
        });
        const reconnected = reducer(connected, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: { ...wallet, label: 'My Ledger' },
        });

        expect(reconnected.externalWallets).toEqual([{ ...wallet, label: 'My Ledger' }]);
    });

    it('marks the previous Ledger disconnected when a different Ledger connects', () => {
        const first = reducer(deviceReducerInitialState, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: wallet,
        });
        const secondWallet = { ...wallet, id: 'wallet2', staticSessionId: 'wallet2@ledger:0' };
        const second = reducer(first, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: secondWallet,
        });

        expect(second.externalWallets?.[0]?.connected).toBe(false);
        expect(second.externalWallets?.[1]?.connected).toBe(true);
        expect(second.selectedExternalWalletId).toBe(secondWallet.id);
    });

    it('keeps a disconnected wallet selectable for its account history', () => {
        const connected = reducer(deviceReducerInitialState, {
            type: `${DEVICE_MODULE_PREFIX}/connectExternalWallet`,
            payload: wallet,
        });
        const disconnected = reducer(connected, {
            type: `${DEVICE_MODULE_PREFIX}/disconnectExternalWallet`,
            payload: wallet.id,
        });

        expect(disconnected.externalWallets?.[0]?.connected).toBe(false);
        expect(disconnected.selectedExternalWalletId).toBe(wallet.id);
    });
});
