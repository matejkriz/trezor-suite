import { type DeviceRootState, type LedgerSuiteDevice, deviceActions } from '@suite-common/device';
import { type LedgerBitcoinServiceDep, type LedgerDevice } from '@suite-common/ledger';
import { type WithServices, createThunk } from '@suite-common/redux-utils';
import TrezorConnect from '@trezor/connect';

import { addDiscoveredLedgerBitcoinWallet } from './addDiscoveredLedgerBitcoinWallet';
import { discoverLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';
import { type AccountsRootState } from '../accounts/accountsReducer';
import { selectAccounts } from '../accounts/accountsSelectors';
import { discoveryActions } from '../discovery/discoveryActions';

type ConnectLedgerBitcoinWalletParams = {
    device: LedgerDevice;
    apiType?: 'usb' | 'bluetooth';
    expectedDeviceId?: string;
};

export type ConnectLedgerBitcoinWalletThunkState = DeviceRootState & AccountsRootState;

export type ConnectLedgerBitcoinWalletThunkDeps = WithServices<LedgerBitcoinServiceDep>;

export const connectLedgerBitcoinWalletThunk = createThunk<
    LedgerSuiteDevice,
    ConnectLedgerBitcoinWalletParams,
    {
        state: ConnectLedgerBitcoinWalletThunkState;
        extra: ConnectLedgerBitcoinWalletThunkDeps;
        rejectValue: string;
    }
>(
    '@common/wallet-core/ledger/connectBitcoinWallet',
    async (
        { device, apiType = 'usb', expectedDeviceId },
        { dispatch, getState, extra, signal, requestId, rejectWithValue },
    ) => {
        let isAcquisitionCommitted = false;
        const disconnect = () =>
            extra.services.ledgerBitcoinService
                .disconnect({ owner: requestId })
                .catch(() => undefined);
        const handleAbort = () => {
            if (isAcquisitionCommitted) return;

            void disconnect();
        };
        signal.addEventListener('abort', handleAbort, { once: true });

        try {
            const discovered = await discoverLedgerBitcoinWallet(
                {
                    ledgerBitcoinService: extra.services.ledgerBitcoinService,
                    getAccountInfo: descriptor =>
                        TrezorConnect.getAccountInfo({
                            coin: 'btc',
                            descriptor,
                            details: 'txs',
                            page: 1,
                            pageSize: 25,
                            suppressBackupWarning: true,
                        }),
                },
                device,
                { signal, owner: requestId },
            );

            if (
                signal.aborted ||
                !extra.services.ledgerBitcoinService.isConnectionOwner(requestId)
            ) {
                return rejectWithValue('Ledger connection canceled');
            }

            if (expectedDeviceId && discovered.wallet.id !== expectedDeviceId) {
                await disconnect();

                return rejectWithValue('Connect the same Ledger wallet to continue');
            }

            isAcquisitionCommitted = true;
            const connectedDevice = addDiscoveredLedgerBitcoinWallet(
                dispatch,
                selectAccounts(getState()),
                discovered,
                apiType,
            );
            dispatch(discoveryActions.startDiscovery(connectedDevice.path));
            dispatch(
                discoveryActions.updateDiscovery({ status: 'complete' }, connectedDevice.path),
            );
            dispatch(deviceActions.selectDevice(connectedDevice));

            return connectedDevice;
        } catch {
            if (!signal.aborted) await disconnect();

            return rejectWithValue('Ledger connection failed');
        } finally {
            signal.removeEventListener('abort', handleAbort);
        }
    },
);
