import { type Dispatch } from '@reduxjs/toolkit';

import { deviceActions } from '@suite-common/device';
import { type Account } from '@suite-common/wallet-types';

import { createLedgerSuiteDevice } from './createLedgerSuiteDevice';
import { type DiscoveredLedgerWallet } from './ledgerWalletTypes';
import { applyDiscoveredAccounts } from '../accounts/applyDiscoveredAccounts';
import { discoveryActions } from '../discovery/discoveryActions';

export const addDiscoveredLedgerWallet = (
    dispatch: Dispatch,
    existingAccounts: Account[],
    { wallet, accounts }: DiscoveredLedgerWallet,
    apiType: 'usb' | 'bluetooth' = 'usb',
) => {
    const device = createLedgerSuiteDevice(wallet, apiType);

    dispatch(discoveryActions.startDiscovery(device.path));
    dispatch(deviceActions.registerDevice(device));
    applyDiscoveredAccounts(
        dispatch,
        existingAccounts,
        accounts,
        wallet.staticSessionId,
        wallet.supportedNetworks ?? accounts.map(account => account.symbol),
    );

    return device;
};
