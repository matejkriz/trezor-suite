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
        const state = reducer(deviceReducerInitialState, deviceActions.registerDevice(ledger));

        expect(state.devices).toEqual([ledger]);
        expect(state.selectedDevice).toEqual(ledger);
        expect(isLedgerDevice(state.selectedDevice)).toBe(true);
    });

    it('updates the same Ledger instead of duplicating it', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.registerDevice(ledger));
        const second = reducer(
            first,
            deviceActions.registerDevice({ ...ledger, name: 'Renamed Ledger' }),
        );

        expect(second.devices).toHaveLength(1);
        expect(second.selectedDevice?.name).toBe('Renamed Ledger');
    });

    it('preserves remembered wallet data on reconnect', () => {
        const first = reducer(
            deviceReducerInitialState,
            deviceActions.registerDevice({
                ...ledger,
                firstConnectedTimestamp: 10,
                metadata: { 1: { fileName: 'wallet-labels', aesKey: 'key', key: 'key' } },
            }),
        );
        const second = reducer(
            first,
            deviceActions.registerDevice({
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

    it('keeps connection ownership outside device registration', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.registerDevice(ledger));
        const other = {
            ...ledger,
            id: 'second-ledger-wallet',
            state: { staticSessionId: 'second-ledger-wallet@ledger:0' as const },
        };
        const second = reducer(first, deviceActions.registerDevice(other));

        expect(second.devices[0]?.connected).toBe(true);
        expect(second.devices[1]).toEqual(other);
        expect(second.selectedDevice).toEqual(other);
    });

    it('keeps a disconnected Ledger selected for account history', () => {
        const first = reducer(deviceReducerInitialState, deviceActions.registerDevice(ledger));
        const disconnected = reducer(first, deviceActions.disconnectDevicesByProvider('ledger'));

        expect(disconnected.devices[0]?.connected).toBe(false);
        expect(disconnected.selectedDevice?.connected).toBe(false);
    });

    it('disconnects only the provider that reports a transport disconnection', () => {
        const trezor = mockSuiteDevice({ connected: true });
        const connected = reducer(
            { ...deviceReducerInitialState, devices: [trezor] },
            deviceActions.registerDevice(ledger),
        );
        const disconnected = reducer(
            connected,
            deviceActions.disconnectDevicesByProvider('ledger'),
        );

        expect(disconnected.devices[0]?.connected).toBe(true);
        expect(disconnected.devices[1]?.connected).toBe(false);
        expect(disconnected.selectedDevice?.connected).toBe(false);
    });
});
