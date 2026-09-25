import { type DesktopDeviceRootState } from './deviceSlice';

export const selectIsConnectionModalOpen = (state: DesktopDeviceRootState) =>
    state.device.isConnectionModalOpen;

export const selectConnectionModalType = (state: DesktopDeviceRootState) =>
    state.device.connectionModalType;

export const selectDeviceDefaultConnectionMode = (state: DesktopDeviceRootState) =>
    state.device.defaultConnectionMode;
