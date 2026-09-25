import { type Dispatch } from '@reduxjs/toolkit';

import { deviceActions } from '@suite-common/device';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { accountsActions } from '@suite-common/wallet-core';
import { type Account } from '@suite-common/wallet-types';

import { type DiscoveredLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';

const bitcoinSymbol = asNetworkSymbol('btc');

export const addDiscoveredLedgerBitcoinWallet = (
    dispatch: Dispatch,
    existingAccounts: Account[],
    { wallet, accounts }: DiscoveredLedgerBitcoinWallet,
) => {
    dispatch(deviceActions.connectExternalWallet(wallet));

    accounts.forEach(({ index, path, accountInfo, visible }) => {
        const existingAccount = existingAccounts.find(
            account =>
                account.deviceState === wallet.staticSessionId &&
                account.symbol === bitcoinSymbol &&
                account.index === index &&
                account.accountType === 'normal' &&
                account.descriptor === accountInfo.descriptor,
        );

        if (existingAccount) {
            dispatch(accountsActions.updateAccount(existingAccount, accountInfo));

            return;
        }

        dispatch(
            accountsActions.createAccount(
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
            ),
        );
    });
};
