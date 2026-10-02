import {
    type DeviceRootState,
    deviceActions,
    selectDeviceByStaticSessionId,
} from '@suite-common/device';
import { type NetworksRootState, selectSupportedNetworkSymbols } from '@suite-common/networks';
import { type WithServices, createThunk } from '@suite-common/redux-utils';
import { type AuthorizedDevice } from '@suite-common/suite-types';
import { type NetworkSymbol } from '@suite-common/wallet-config';
import { type DiscoveryStatus } from '@suite-common/wallet-types';
import TrezorConnect from '@trezor/connect';
import { asCoinSymbol } from '@trezor/connect-common';

import { DISCOVERY_MODULE_PREFIX, discoveryActions } from './discoveryActions';
import { type DiscoveryRootState } from './discoveryReducer';
import { isDiscoveryInProgress, selectDiscoveryByDevicePath } from './discoverySelectors';
import { type AccountsRootState } from '../accounts/accountsReducer';
import { selectAccounts } from '../accounts/accountsSelectors';
import { applyDiscoveredAccounts } from '../accounts/applyDiscoveredAccounts';
import { selectSupportedNetworkByDevice } from '../device/deviceSelectors';
import {
    type WalletSettingsRootState,
    selectEnabledNetworks,
} from '../settings/walletSettingsReducer';
import { WalletDeviceActionError } from '../wallet-device/walletDeviceError';
import { type WalletDeviceServiceDep } from '../wallet-device/walletDeviceTypes';

export const getWalletDeviceDiscoveryCompletionStatus = (
    failedNetworks: readonly NetworkSymbol[],
): DiscoveryStatus =>
    failedNetworks.length > 0
        ? {
              status: 'failed',
              error: 'Some enabled networks could not be discovered. Please try again.',
          }
        : { status: 'complete' };

type RunWalletDeviceDiscoveryThunkState = DeviceRootState &
    AccountsRootState &
    DiscoveryRootState &
    WalletSettingsRootState &
    NetworksRootState;

type RunWalletDeviceDiscoveryThunkDeps = WithServices<WalletDeviceServiceDep>;

export const runWalletDeviceDiscoveryThunk = createThunk<
    void,
    AuthorizedDevice,
    { state: RunWalletDeviceDiscoveryThunkState; extra: RunWalletDeviceDiscoveryThunkDeps }
>(
    `${DISCOVERY_MODULE_PREFIX}/runWalletDevice`,
    async (device, { dispatch, getState, extra, signal, requestId }) => {
        const operations = extra.services.walletDeviceService.get(device);
        if (
            !operations ||
            !isDiscoveryInProgress(selectDiscoveryByDevicePath(getState(), device.path))
        )
            return;

        dispatch(discoveryActions.updateDiscovery({ status: 'starting', requestId }, device.path));
        const isActiveRequest = () => {
            const discovery = selectDiscoveryByDevicePath(getState(), device.path);

            return isDiscoveryInProgress(discovery) && discovery.requestId === requestId;
        };
        const isCurrentDiscovery = () => {
            const currentDevice = selectDeviceByStaticSessionId(
                getState(),
                device.state.staticSessionId,
            );

            return (
                isActiveRequest() &&
                currentDevice?.connected &&
                currentDevice.path === device.path &&
                currentDevice.state.sessionId === device.state.sessionId
            );
        };
        const cancel = () => {
            if (!isActiveRequest()) return;
            dispatch(discoveryActions.updateDiscovery({ status: 'cancelled' }, device.path));
            void extra.services.walletDeviceService
                .cancelAction({
                    device,
                    reason: { reason: 'USER_UI_CANCEL' },
                })
                .catch(() => undefined);
        };
        signal.addEventListener('abort', cancel, { once: true });

        try {
            if (signal.aborted) {
                cancel();

                return;
            }
            if (!isCurrentDiscovery()) {
                cancel();

                return;
            }
            const supportedNetworks = selectSupportedNetworkByDevice(
                device,
                selectSupportedNetworkSymbols(getState()),
            );
            const networkSymbols = selectEnabledNetworks(getState()).filter(symbol =>
                supportedNetworks.includes(symbol),
            );
            const result = await operations.discoverAccounts({
                networkSymbols,
                signal,
                getAccountInfo: ({ symbol, descriptor }) =>
                    TrezorConnect.getAccountInfo({
                        coin: asCoinSymbol(symbol),
                        descriptor,
                        details: 'txs',
                        page: 1,
                        pageSize: 25,
                        suppressBackupWarning: true,
                    }),
            });
            if (signal.aborted || !isCurrentDiscovery()) {
                cancel();

                return;
            }
            applyDiscoveredAccounts(
                dispatch,
                selectAccounts(getState()),
                result.accounts,
                device.state.staticSessionId,
                supportedNetworks,
            );
            const status = getWalletDeviceDiscoveryCompletionStatus(result.failedNetworks);
            dispatch(
                deviceActions.setDiscovered(
                    device.state.staticSessionId,
                    status.status === 'complete',
                ),
            );
            dispatch(discoveryActions.updateDiscovery(status, device.path));
        } catch (error) {
            if (signal.aborted || !isCurrentDiscovery()) {
                cancel();

                return;
            }
            if (error instanceof WalletDeviceActionError && error.kind !== 'timeout') {
                dispatch(discoveryActions.updateDiscovery({ status: 'cancelled' }, device.path));

                return;
            }
            // SDK and backend errors may contain wallet data; expose only a static message.
            dispatch(
                discoveryActions.updateDiscovery(
                    { status: 'failed', error: 'Account discovery failed. Please try again.' },
                    device.path,
                ),
            );
        } finally {
            signal.removeEventListener('abort', cancel);
        }
    },
);
