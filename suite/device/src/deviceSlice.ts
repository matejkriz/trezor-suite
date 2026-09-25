import { type PayloadAction, isAnyOf } from '@reduxjs/toolkit';

import {
    type DeviceReducerDeps,
    type DeviceReducerState,
    deviceInitialState as commonInitialState,
    deviceActions,
    prepareDeviceReducer as prepareCommonDeviceReducer,
} from '@suite-common/device';
import { createSliceWithExtraDeps } from '@suite-common/redux-utils';

type ConnectionMode = 'cable' | 'bluetooth';
type ConnectionModalType = 'trezor' | 'ledger';

export type DesktopDeviceState = DeviceReducerState & {
    isConnectionModalOpen: boolean;
    connectionModalType: ConnectionModalType;
    defaultConnectionMode: ConnectionMode;
};

export const initialState: DesktopDeviceState = {
    ...commonInitialState,
    isConnectionModalOpen: false,
    connectionModalType: 'trezor',
    defaultConnectionMode: 'cable',
};

export type DesktopDeviceRootState = {
    device: DesktopDeviceState;
};

const deviceSlice = createSliceWithExtraDeps({
    name: 'device',
    initialState,
    reducers: {
        toggleConnectionModal: (state: DesktopDeviceState) => {
            state.isConnectionModalOpen = !state.isConnectionModalOpen;
            state.connectionModalType = 'trezor';
        },
        setConnectionModal: (state: DesktopDeviceState, { payload }: PayloadAction<boolean>) => {
            state.isConnectionModalOpen = payload;
            state.connectionModalType = 'trezor';
        },
        openConnectionModal: (
            state: DesktopDeviceState,
            { payload }: PayloadAction<ConnectionModalType>,
        ) => {
            state.isConnectionModalOpen = true;
            state.connectionModalType = payload;
        },
        setConnectionMode: (
            state: DesktopDeviceState,
            { payload }: PayloadAction<ConnectionMode>,
        ) => {
            state.defaultConnectionMode = payload;
        },
    },
    extraReducers: (builder, extra: DeviceReducerDeps) => {
        const commonReducer = prepareCommonDeviceReducer(extra);

        builder
            .addMatcher(
                isAnyOf(deviceActions.connectDevice, deviceActions.connectUnacquiredDevice),
                (state, action) => {
                    state.isConnectionModalOpen = false;
                    commonReducer(state, action);
                },
            )
            .addDefaultCase((state, action) => {
                commonReducer(state, action);
            });
    },
});

export const { toggleConnectionModal, setConnectionModal, openConnectionModal, setConnectionMode } =
    deviceSlice.actions;
export const desktopDeviceActions = deviceSlice.actions;
export const prepareDesktopDeviceReducer = deviceSlice.prepareReducer;
