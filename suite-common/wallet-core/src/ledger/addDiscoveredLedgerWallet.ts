import { type Dispatch } from '@reduxjs/toolkit';

import { deviceActions } from '@suite-common/device';
import { type Account } from '@suite-common/wallet-types';

import { createLedgerSuiteDevice } from './createLedgerSuiteDevice';
import { type DiscoveredLedgerWallet } from './ledgerWalletTypes';
import { accountsActions } from '../accounts/accountsActions';

export const addDiscoveredLedgerWallet = (
    dispatch: Dispatch,
    existingAccounts: Account[],
    { wallet, accounts }: DiscoveredLedgerWallet,
    apiType: 'usb' | 'bluetooth' = 'usb',
) => {
    const device = createLedgerSuiteDevice(wallet, apiType);

    const accountActions = accounts.map(
        ({ symbol, accountType, index, path, accountInfo, visible }) => {
            const existingAccount = existingAccounts.find(
                account =>
                    account.deviceState === wallet.staticSessionId &&
                    account.symbol === symbol &&
                    account.index === index &&
                    account.accountType === accountType &&
                    account.descriptor === accountInfo.descriptor,
            );

            if (existingAccount) {
                return accountsActions.updateAccount(existingAccount, accountInfo);
            }

            return accountsActions.createAccount(
                {
                    deviceState: wallet.staticSessionId,
                    symbol,
                    index,
                    accountType,
                    path,
                    accountInfo,
                    visible,
                },
                wallet.supportedNetworks ?? [symbol],
            );
        },
    );

    dispatch(deviceActions.connectLedgerDevice(device));
    accountActions.forEach(action => dispatch(action));

    return device;
};
