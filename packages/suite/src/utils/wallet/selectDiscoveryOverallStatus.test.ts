import { mockNetworksState } from '@suite-common/networks/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { createLedgerSuiteDevice } from '@suite-common/wallet-core';
import { type DiscoveryStatus } from '@suite-common/wallet-types';

import { selectDiscoveryOverallStatus } from './selectDiscoveryOverallStatus';
import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

const btc = asNetworkSymbol('btc');
const eth = asNetworkSymbol('eth');
const device = createLedgerSuiteDevice({
    id: 'discovery-wallet',
    label: 'Hardware wallet',
    staticSessionId: 'discovery-wallet@ledger:0',
    supportedNetworks: [btc, eth],
});

describe('provider discovery status', () => {
    const getState = (discovery: DiscoveryStatus, enabledNetworks = [btc, eth]) => ({
        ...mockInitialAppState,
        networks: mockNetworksState([btc, eth]),
        device: { ...mockInitialAppState.device, devices: [device], selectedDevice: device },
        wallet: {
            ...mockInitialAppState.wallet,
            discovery: { [device.path]: discovery },
            settings: { ...mockInitialAppState.wallet.settings, enabledNetworks },
        },
    });

    it('shows loading during Ledger discovery', () => {
        expect(selectDiscoveryOverallStatus(getState({ status: 'starting' }))).toEqual({
            status: 'loading',
            type: 'discovery',
        });
    });

    it('shows a backend failure and clears it after successful retry', () => {
        expect(
            selectDiscoveryOverallStatus(
                getState({ status: 'failed', error: 'Backend unavailable' }),
            ),
        ).toEqual({
            status: 'exception',
            type: 'discovery-failed',
        });
        expect(selectDiscoveryOverallStatus(getState({ status: 'complete' }))).toBeUndefined();
    });

    it('shows empty discovery when no supported network is enabled', () => {
        expect(selectDiscoveryOverallStatus(getState({ status: 'complete' }, []))).toEqual({
            status: 'exception',
            type: 'discovery-empty',
        });
    });
});
