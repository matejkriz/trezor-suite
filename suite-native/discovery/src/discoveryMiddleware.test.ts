import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { deviceActions, prepareDeviceReducer } from '@suite-common/device';
import { mockNetworksState } from '@suite-common/networks/mocks';
import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import {
    changeNetworks,
    createLedgerSuiteDevice,
    discoveryActions,
    prepareDiscoveryReducer,
    prepareWalletSettingsReducer,
    selectIsBitcoinEnabled,
    startOrRestartDiscoveryThunk,
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

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    startOrRestartDiscoveryThunk: jest.fn(() => ({ type: 'test/start-device-discovery' })),
}));

describe('Ledger selection in native discovery', () => {
    it('enables Bitcoin and starts regular discovery when a supported Ethereum network is missing', async () => {
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
            networks: createStaticReducer(mockNetworksState(['btc', 'eth'].map(asNetworkSymbol))),
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
        expect(startOrRestartDiscoveryThunk).not.toHaveBeenCalled();

        const multiNetworkDevice = createLedgerSuiteDevice({
            id: device.id,
            label: device.label,
            staticSessionId: device.state.staticSessionId,
            supportedNetworks: ['btc', 'eth'].map(asNetworkSymbol),
            accountsDiscoveryAppVersion: '0.1.0',
        });
        store.dispatch(deviceActions.connectLedgerDevice(multiNetworkDevice));
        store.dispatch(
            changeNetworks(
                ['btc', 'eth'].map(asNetworkSymbol),
                ['btc', 'eth'].map(asNetworkSymbol),
            ),
        );
        store.dispatch(deviceActions.selectDevice(multiNetworkDevice));
        expect(startOrRestartDiscoveryThunk).toHaveBeenCalledTimes(1);
        expect(getAccountInfo).not.toHaveBeenCalled();

        jest.restoreAllMocks();
    });
});
