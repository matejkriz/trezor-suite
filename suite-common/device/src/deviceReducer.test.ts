import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import fixtures from './__fixtures__/deviceReducer';
import { deviceActions } from './deviceActions';
import { prepareDeviceReducer } from './deviceReducer';
import { type LedgerSuiteDevice } from './ledgerDevice';

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

type State = ReturnType<typeof deviceReducer>;

describe('Ledger session lifecycle', () => {
    it('removes pending button requests when the physical Ledger session ends', () => {
        const device = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                connected: true,
                state: { staticSessionId: 'ledgerwallet@ledger:0', sessionId: 'acquisition-a' },
                buttonRequests: [{ code: 'ButtonRequest_Address' }],
            }),
            provider: 'ledger',
        } as LedgerSuiteDevice;
        const connectedState = deviceReducer(undefined, deviceActions.connectLedgerDevice(device));
        const state = deviceReducer(
            { ...connectedState, selectedDevice: { ...device } },
            deviceActions.disconnectLedgerDevice(device.id),
        );

        expect(state.devices[0]).toMatchObject({ connected: false, buttonRequests: [] });
        expect(state.selectedDevice).toMatchObject({ connected: false, buttonRequests: [] });
    });
});

describe('DEVICE.CONNECT', () => {
    fixtures.connect.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            // console.log('initialSTATE', state);
            f.actions.forEach(a => {
                state = deviceReducer(state, a);
            });
            // console.log('afterSTATE', state);
            expect(state.devices.length).toEqual(f.result.length);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
            });
        });
    });
});

describe('DEVICE.CHANGED', () => {
    fixtures.changed.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            f.actions.forEach(a => {
                state = deviceReducer(state, a);
            });
            expect(state.devices.length).toEqual(f.result.length);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
            });
        });
    });
});

describe('DEVICE.DISCONNECT', () => {
    fixtures.disconnect.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            f.actions.forEach(a => {
                // intentionally use "undefined" as state to cover "initialState" line inside reducer
                state = deviceReducer(state.devices.length === 0 ? undefined : state, a);
            });
            expect(state.devices.length).toEqual(f.result.length);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
            });
        });
    });
});

describe('SUITE.SELECT_DEVICE', () => {
    fixtures.selectDevice.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            f.actions.forEach(a => {
                state = deviceReducer(state, a);
            });
            expect(state.devices.length).toEqual(f.result.length);
            // console.log('afterSTATE', state);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
                if ((f.ts[i] ?? 0) > 0) {
                    expect(device.ts).toBeGreaterThan(0);
                } else {
                    expect(device.ts).toEqual(0);
                }
            });
        });
    });
});

describe('SUITE.FORGET_DEVICE', () => {
    fixtures.forget.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            f.actions.forEach(a => {
                state = deviceReducer(state, a);
            });
            expect(state.devices.length).toEqual(f.result.length);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
            });
        });
    });
});

describe('SUITE.REMEMBER_DEVICE', () => {
    fixtures.remember.forEach(f => {
        it(f.description, () => {
            let state: State = f.initialState;
            f.actions.forEach(a => {
                state = deviceReducer(state, a);
            });
            expect(state.devices.length).toEqual(f.result.length);
            state.devices.forEach((device, i) => {
                const expected = f.result[i];
                if (!expected) throw new Error(`Missing result at index ${i}`);
                expect(device).toMatchObject(expected);
            });
        });
    });
});
