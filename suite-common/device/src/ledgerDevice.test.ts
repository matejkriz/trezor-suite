import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { deviceActions } from './deviceActions';
import { deviceReducerInitialState, prepareDeviceReducer } from './deviceReducer';
import { type LedgerSuiteDevice, isLedgerDevice } from './ledgerDevice';

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

const ledger = {
    ...mockSuiteDevice({ id: 'ledger-wallet', name: 'Ledger Flex' }),
    provider: 'ledger' as const,
    state: { staticSessionId: 'ledger-wallet@ledger:0' as const },
    remember: true,
    connected: true,
} as LedgerSuiteDevice;

describe('Ledger device selection', () => {
    it('adds Ledger to devices and selects it', () => {
        const state = reducer(deviceReducerInitialState, deviceActions.connectLedgerDevice(ledger));

        expect(state.devices).toEqual([ledger]);
        expect(state.selectedDevice).toEqual(ledger);
        expect(isLedgerDevice(state.selectedDevice)).toBe(true);
    });

    it('updates the same Ledger instead of duplicating it', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.connectLedgerDevice(ledger));
        const second = reducer(
            first,
            deviceActions.connectLedgerDevice({ ...ledger, name: 'Renamed Ledger' }),
        );

        expect(second.devices).toHaveLength(1);
        expect(second.selectedDevice?.name).toBe('Renamed Ledger');
    });

    it('preserves remembered wallet data on reconnect', () => {
        const first = reducer(
            deviceReducerInitialState,
            deviceActions.connectLedgerDevice({
                ...ledger,
                firstConnectedTimestamp: 10,
                metadata: { 1: { fileName: 'wallet-labels', aesKey: 'key', key: 'key' } },
            }),
        );
        const second = reducer(
            first,
            deviceActions.connectLedgerDevice({
                ...ledger,
                name: 'Ledger Flex from SDK',
                firstConnectedTimestamp: 20,
            }),
        );

        expect(second.devices[0]).toMatchObject({
            name: 'Ledger Flex from SDK',
            firstConnectedTimestamp: 10,
            metadata: { 1: { fileName: 'wallet-labels', aesKey: 'key', key: 'key' } },
        });
        expect(second.selectedDevice).toEqual(second.devices[0]);
    });

    it('disconnects the previous Ledger when another one connects', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.connectLedgerDevice(ledger));
        const other = {
            ...ledger,
            id: 'second-ledger-wallet',
            state: { staticSessionId: 'second-ledger-wallet@ledger:0' as const },
        };
        const second = reducer(first, deviceActions.connectLedgerDevice(other));

        expect(second.devices[0]?.connected).toBe(false);
        expect(second.devices[1]).toEqual(other);
        expect(second.selectedDevice).toEqual(other);
    });

    it('keeps a disconnected Ledger selected for account history', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.connectLedgerDevice(ledger));
        const disconnected = reducer(first, deviceActions.disconnectLedgerDevice(ledger.id));

        expect(disconnected.devices[0]?.connected).toBe(false);
        expect(disconnected.selectedDevice?.connected).toBe(false);
    });
});
