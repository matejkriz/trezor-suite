import { mockNetworksState } from '@suite-common/networks/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';

import { selectDeviceSupportedNetworks } from './device/deviceSelectors';

describe('selectDeviceSupportedNetworks', () => {
    it('offers Bitcoin only when a Ledger wallet is selected', () => {
        const selectedDevice = {
            ...mockSuiteDevice({
                connected: true,
                state: { staticSessionId: 'xpub@ledger:0' },
                unavailableCapabilities: { eth: 'no-support' },
            }),
            provider: 'ledger' as const,
        };
        const state = {
            networks: mockNetworksState([asNetworkSymbol('btc'), asNetworkSymbol('eth')]),
            device: {
                devices: [selectedDevice],
                selectedDevice,
            },
        };

        expect(selectDeviceSupportedNetworks(state)).toEqual([asNetworkSymbol('btc')]);
    });
});
