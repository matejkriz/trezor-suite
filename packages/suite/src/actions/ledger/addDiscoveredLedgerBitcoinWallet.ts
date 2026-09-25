import { type Dispatch } from '@reduxjs/toolkit';

import { deviceActions } from '@suite-common/device';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { accountsActions } from '@suite-common/wallet-core';

import { type DiscoveredLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';

const bitcoinSymbol = asNetworkSymbol('btc');

export const addDiscoveredLedgerBitcoinWallet = (
    dispatch: Dispatch,
    { wallet, accounts }: DiscoveredLedgerBitcoinWallet,
) => {
    dispatch(deviceActions.connectExternalWallet(wallet));

    accounts.forEach(({ index, path, accountInfo, visible }) => {
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
