import { waitFor } from '@testing-library/react';
import { type CryptoId } from 'invity-api';

import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot, renderHookWithStoreProvider } from '@suite-common/test-utils';
import { asNetworkSymbol, getNetwork } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { useTradingReceiveAddress } from './useTradingReceiveAddress';

const symbol = asNetworkSymbol('btc');
const staticSessionId = 'ledgerwallet@ledger:0' as const;
const ledgerAccount = mockWalletAccount({
    symbol,
    deviceState: staticSessionId,
    path: "m/84'/0'/0'",
    addresses: {
        change: [],
        used: [],
        unused: [
            {
                address: 'bc1qtestledgeraddress',
                path: "m/84'/0'/0'/0/0",
                transfers: 0,
                balance: '0',
                received: '0',
                sent: '0',
            },
        ],
    },
});

describe(useTradingReceiveAddress.name, () => {
    it('offers a selected Ledger Bitcoin account for Buy receive and hides Trezor add-account', async () => {
        const ledgerDevice = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                state: { staticSessionId },
                connected: true,
                available: true,
            }),
            provider: 'ledger' as const,
        };
        const root = createTestCompositionRoot({
            extra: {
                services: {
                    networks: { addressValidator: { isAddressValid: () => true } },
                },
            },
            preloadedState: {
                debug: { showDebugMenu: false },
                device: {
                    selectedDevice: ledgerDevice,
                },
                networks: { btc: getNetwork(symbol) },
                wallet: {
                    accounts: [ledgerAccount],
                    selectedAccount: { account: ledgerAccount, status: 'loaded' },
                    trading: {
                        buy: {},
                        exchange: {},
                    },
                },
                suiteSettings: { experimental: [], isTestnetNetworksEnabled: false },
            },
        });

        const { result } = renderHookWithStoreProvider(
            () =>
                useTradingReceiveAddress({
                    type: 'buy',
                    cryptoId: 'bitcoin' as CryptoId,
                    nonSuiteAccount: false,
                }),
            { root },
        );

        await waitFor(() => expect(result.current.suiteReceiveAccounts).toEqual([ledgerAccount]));
        expect(result.current.canAddSuiteAccount).toBe(false);
    });
});
