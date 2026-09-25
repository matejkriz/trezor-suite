import { mockNetworksState } from '@suite-common/networks/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';

import { selectDeviceSupportedNetworks } from './device/deviceSelectors';

describe('selectDeviceSupportedNetworks', () => {
    it('offers Bitcoin only when a Ledger wallet is selected', () => {
        const state = {
            networks: mockNetworksState([asNetworkSymbol('btc'), asNetworkSymbol('eth')]),
            device: {
                devices: [],
                externalWallets: [
                    {
                        id: 'wallet-1',
                        provider: 'ledger' as const,
                        label: 'Ledger',
                        staticSessionId: 'xpub@ledger:0' as const,
                        connected: true,
                    },
                ],
                selectedExternalWalletId: 'wallet-1',
            },
        };

        expect(selectDeviceSupportedNetworks(state)).toEqual([asNetworkSymbol('btc')]);
    });
});
