import { type ComponentProps } from 'react';

import '@suite-common/test-utils/globalOverrides';
import { mockNetworksState } from '@suite-common/networks/mocks';
import { createTestCompositionRoot, fireEvent, screen } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { createLedgerSuiteDevice } from '@suite-common/wallet-core';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { GlobalReceiveModal } from './GlobalReceiveModal';
import { type GlobalReceiveSearchStep } from './steps/GlobalReceiveSearchStep';
import { mockInitialAppState } from '../../../../../../../../mocks/mockInitialAppState';

jest.mock('./hooks/useGlobalReceiveAssets', () => ({
    useGlobalReceiveAssets: () => ({
        assets: [{ id: 'ethereum', networkSymbol: 'eth', name: 'Ethereum' }],
        balances: {},
        networks: ['eth'],
        catalogStatus: 'ready',
        retry: jest.fn(),
    }),
}));
jest.mock('./steps/GlobalReceiveSearchStep', () => ({
    GlobalReceiveSearchStep: ({
        assets,
        onAssetClick,
    }: ComponentProps<typeof GlobalReceiveSearchStep>) => (
        <>
            {assets.map(asset => (
                <button key={asset.id} onClick={() => onAssetClick(asset)}>
                    {asset.name}
                </button>
            ))}
        </>
    ),
}));

describe('Global Receive with provider discovery', () => {
    it('offers Ethereum and selects its discovered account for receiving', () => {
        const device = createLedgerSuiteDevice({
            id: 'testwallet',
            label: 'Wallet',
            staticSessionId: 'testwallet@ledger:0',
            supportedNetworks: ['btc', 'eth'].map(asNetworkSymbol),
        });
        const account = mockWalletAccount({
            symbol: asNetworkSymbol('eth'),
            deviceState: device.state.staticSessionId,
            visible: true,
        });
        const root = createTestCompositionRoot({
            preloadedState: {
                ...mockInitialAppState,
                networks: mockNetworksState(['btc', 'eth'].map(asNetworkSymbol)),
                device: {
                    ...mockInitialAppState.device,
                    devices: [device],
                    selectedDevice: device,
                },
                wallet: {
                    ...mockInitialAppState.wallet,
                    accounts: [account],
                    settings: {
                        ...mockInitialAppState.wallet.settings,
                        enabledNetworks: ['btc', 'eth'].map(asNetworkSymbol),
                    },
                },
            },
        });
        const onSubmit = jest.fn();

        renderWithProviders(root, <GlobalReceiveModal onCancel={jest.fn()} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Ethereum' }));

        expect(onSubmit).toHaveBeenCalledWith(account, false);
    });
});
