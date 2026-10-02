import { type DeviceRootState, type LedgerSuiteDevice, deviceActions } from '@suite-common/device';
import { type LedgerBitcoinServiceDep, type LedgerDevice } from '@suite-common/ledger';
import { type WithServices, createThunk } from '@suite-common/redux-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import TrezorConnect from '@trezor/connect';
import { asCoinSymbol } from '@trezor/connect-common';

import { addDiscoveredLedgerWallet } from './addDiscoveredLedgerWallet';
import { discoverLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';
import { discoverLedgerWalletWithAccountsApp } from './discoverLedgerWalletWithAccountsApp';
import { type AccountsRootState } from '../accounts/accountsReducer';
import { selectAccounts } from '../accounts/accountsSelectors';
import { discoveryActions } from '../discovery/discoveryActions';
import { getWalletDeviceDiscoveryCompletionStatus } from '../discovery/runWalletDeviceDiscoveryThunk';
import {
    type WalletSettingsRootState,
    selectEnabledNetworks,
} from '../settings/walletSettingsReducer';

type ConnectLedgerBitcoinWalletParams = {
    device: LedgerDevice;
    apiType?: 'usb' | 'bluetooth';
    expectedDeviceId?: string;
};

export type ConnectLedgerBitcoinWalletThunkState = DeviceRootState &
    AccountsRootState &
    WalletSettingsRootState;

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
            const { ledgerBitcoinService } = extra.services;
            const isCurrentConnection = () =>
                !signal.aborted && ledgerBitcoinService.isConnectionOwner(requestId);
            if (signal.aborted) return rejectWithValue('Ledger connection canceled');
            await ledgerBitcoinService.connect(device, { owner: requestId });
            if (!isCurrentConnection()) return rejectWithValue('Ledger connection canceled');

            const hasAccountsDiscovery = await ledgerBitcoinService.hasAccountsDiscovery();
            if (!isCurrentConnection()) return rejectWithValue('Ledger connection canceled');

            const getAccountInfo = (coin: string, descriptor: string) =>
                TrezorConnect.getAccountInfo({
                    coin: asCoinSymbol(coin),
                    descriptor,
                    details: 'txs',
                    page: 1,
                    pageSize: 25,
                    suppressBackupWarning: true,
                });
            const enabledNetworks = selectEnabledNetworks(getState());
            const discovered = hasAccountsDiscovery
                ? await discoverLedgerWalletWithAccountsApp(
                      {
                          ledgerBitcoinService,
                          getAccountInfo: ({ symbol, descriptor }) =>
                              getAccountInfo(symbol, descriptor),
                      },
                      {
                          signal,
                          owner: requestId,
                          networkSymbols:
                              enabledNetworks.length > 0
                                  ? enabledNetworks
                                  : [asNetworkSymbol('btc'), asNetworkSymbol('eth')],
                      },
                  )
                : await discoverLedgerBitcoinWallet(
                      {
                          ledgerBitcoinService,
                          getAccountInfo: descriptor => getAccountInfo('btc', descriptor),
                      },
                      { signal, owner: requestId },
                  );

            if (!isCurrentConnection()) {
                return rejectWithValue('Ledger connection canceled');
            }

            if (expectedDeviceId && discovered.wallet.id !== expectedDeviceId) {
                await disconnect();

                return rejectWithValue('Connect the same Ledger wallet to continue');
            }

            isAcquisitionCommitted = true;
            const connectedDevice = addDiscoveredLedgerWallet(
                dispatch,
                selectAccounts(getState()),
                discovered,
                apiType,
            );
            dispatch(
                discoveryActions.updateDiscovery(
                    getWalletDeviceDiscoveryCompletionStatus(discovered.failedNetworks ?? []),
                    connectedDevice.path,
                ),
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
