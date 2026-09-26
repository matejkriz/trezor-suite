import { type Dispatch } from '@reduxjs/toolkit';

import { deviceActions } from '@suite-common/device';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type Account } from '@suite-common/wallet-types';

import { createLedgerSuiteDevice } from './createLedgerSuiteDevice';
import { type DiscoveredLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';
import { accountsActions } from '../accounts/accountsActions';

const bitcoinSymbol = asNetworkSymbol('btc');

export const addDiscoveredLedgerBitcoinWallet = (
    dispatch: Dispatch,
    existingAccounts: Account[],
    { wallet, accounts }: DiscoveredLedgerBitcoinWallet,
    apiType: 'usb' | 'bluetooth' = 'usb',
) => {
    const device = createLedgerSuiteDevice(wallet, apiType);

    const accountActions = accounts.map(({ index, path, accountInfo, visible }) => {
        const existingAccount = existingAccounts.find(
            account =>
                account.deviceState === wallet.staticSessionId &&
                account.symbol === bitcoinSymbol &&
                account.index === index &&
                account.accountType === 'normal' &&
                account.descriptor === accountInfo.descriptor,
        );

        if (existingAccount) {
            return accountsActions.updateAccount(existingAccount, accountInfo);
        }

        return accountsActions.createAccount(
            {
                deviceState: wallet.staticSessionId,
                symbol: bitcoinSymbol,
                index,
                accountType: 'normal',
                path,
                accountInfo,
                visible,
            },
            [bitcoinSymbol],
        );
    });

    dispatch(deviceActions.connectLedgerDevice(device));
    accountActions.forEach(action => dispatch(action));

    return device;
};
