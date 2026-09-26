import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { deviceActions, prepareDeviceReducer } from '@suite-common/device';
import { mockNetworksState } from '@suite-common/networks/mocks';
import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import {
    createLedgerSuiteDevice,
    discoveryActions,
    prepareDiscoveryReducer,
    prepareWalletSettingsReducer,
    selectIsBitcoinEnabled,
} from '@suite-common/wallet-core';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { createStaticReducer } from '@suite-native/test-utils-store';
import TrezorConnect from '@trezor/connect';

import { prepareDiscoveryMiddleware } from './discoveryMiddleware';
import { pendingCoinVisibilitySlice } from './pendingCoinVisibilitySlice';

jest.mock('@suite-native/device', () => ({
    ...jest.requireActual('@suite-native/device'),
    selectCompromisedDeviceFailedCheck: () => null,
}));

jest.mock('@suite-common/token-definitions', () => ({
    ...jest.requireActual('@suite-common/token-definitions'),
    periodicCheckTokenDefinitionsThunk: () => ({ type: 'test/check-token-definitions' }),
}));

describe('Ledger selection in native discovery', () => {
    it('enables Bitcoin through regular selection without starting Trezor discovery', async () => {
        const device = createLedgerSuiteDevice({
            id: 'ledger-wallet',
            label: 'My travel wallet',
            staticSessionId: 'ledgerwallet@ledger:0',
        });
        const account = mockWalletAccount({
            symbol: asNetworkSymbol('btc'),
            deviceState: device.state?.staticSessionId,
        });
        const reducer = combineReducers({
            device: prepareDeviceReducer({
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
            }),
            networks: createStaticReducer(mockNetworksState([asNetworkSymbol('btc')])),
            pendingCoinVisibility: pendingCoinVisibilitySlice.reducer,
            wallet: combineReducers({
                accounts: createStaticReducer([account]),
                discovery: prepareDiscoveryReducer({}),
                settings: prepareWalletSettingsReducer({
                    actionTypes: { storageLoad: mockActionType('storageLoad') },
                    reducers: { storageLoadWalletSettings: mockReducer() },
                }),
            }),
        });
        const store = configureStore({
            reducer,
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware().concat(prepareDiscoveryMiddleware(() => ({}))),
        });
        jest.spyOn(TrezorConnect, 'updateConnectSettings').mockResolvedValue({
            success: true,
            payload: { message: 'success' },
        });
        const getAccountInfo = jest.spyOn(TrezorConnect, 'getAccountInfo');

        expect(selectIsBitcoinEnabled(store.getState())).toBe(false);
        store.dispatch(deviceActions.connectLedgerDevice(device));
        store.dispatch(discoveryActions.startDiscovery(device.path));
        store.dispatch(discoveryActions.updateDiscovery({ status: 'complete' }, device.path));
        store.dispatch(deviceActions.selectDevice(device));
        await Promise.resolve();

        expect(selectIsBitcoinEnabled(store.getState())).toBe(true);
        expect(store.getState().device.selectedDevice?.id).toBe(device.id);
        expect(store.getState().wallet.accounts).toEqual([account]);
        expect(store.getState().wallet.discovery[device.path]?.status).toBe('complete');
        expect(getAccountInfo).not.toHaveBeenCalled();

        jest.restoreAllMocks();
    });
});
