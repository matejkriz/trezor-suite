import { type Dispatch } from '@reduxjs/toolkit';

import { type NetworkSymbol } from '@suite-common/wallet-config';
import { type Account } from '@suite-common/wallet-types';
import { type StaticSessionId } from '@trezor/connect';

import { accountsActions } from './accountsActions';
import { type WalletDeviceDiscoveredAccount } from '../wallet-device/walletDeviceTypes';

export const applyDiscoveredAccounts = (
    dispatch: Dispatch,
    existingAccounts: Account[],
    discoveredAccounts: WalletDeviceDiscoveredAccount[],
    deviceState: StaticSessionId,
    supportedNetworks: readonly NetworkSymbol[],
) => {
    discoveredAccounts.forEach(account => {
        const existingAccount = existingAccounts.find(
            candidate =>
                candidate.deviceState === deviceState &&
                candidate.symbol === account.symbol &&
                candidate.index === account.index &&
                candidate.accountType === account.accountType &&
                candidate.descriptor === account.accountInfo.descriptor,
        );
        dispatch(
            existingAccount
                ? accountsActions.updateAccount(existingAccount, account.accountInfo)
                : accountsActions.createAccount({ ...account, deviceState }, supportedNetworks),
        );
    });
};
