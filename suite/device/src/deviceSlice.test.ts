import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';

import { initialState, prepareDesktopDeviceReducer, setConnectionModal } from './deviceSlice';

const reducer = prepareDesktopDeviceReducer({
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

describe('connection modal device type', () => {
    it('opens directly in Ledger mode and resets to Trezor for a later standard connection', () => {
        const ledgerState = reducer(initialState, {
            type: 'device/openConnectionModal',
            payload: 'ledger',
        });

        expect(ledgerState.isConnectionModalOpen).toBe(true);
        expect(ledgerState.connectionModalType).toBe('ledger');

        const closedState = reducer(ledgerState, setConnectionModal(false));
        const trezorState = reducer(closedState, setConnectionModal(true));

        expect(trezorState.connectionModalType).toBe('trezor');
    });
});
