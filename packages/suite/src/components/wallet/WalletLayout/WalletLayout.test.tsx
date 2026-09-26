import '@suite-common/test-utils/globalOverrides';

import { screen } from '@testing-library/react';
import { StyleSheetManager } from 'styled-components';

import { mockDesktopAnalytics } from '@suite/analytics/mocks';
import { type PageName } from '@suite/router';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import { asNetworkSymbol, getNetwork } from '@suite-common/wallet-config';
import { useWalletDeviceAccountCapabilities } from '@suite-common/wallet-core';
import { type SelectedAccountLoaded } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { type AppState } from 'src/reducers/store';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { WalletLayout } from './WalletLayout';
import { mockInitialAppState } from '../../../../mocks/mockInitialAppState';

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    useWalletDeviceAccountCapabilities: jest.fn(),
}));

jest.mock('src/components/suite/layouts/SuiteLayout', () => ({
    PageHeader: () => null,
}));

jest.mock('src/support/suite/styles/GlobalStyle', () => ({
    __esModule: true,
    default: () => null,
}));

const mockCapabilities = jest.mocked(useWalletDeviceAccountCapabilities);
const mockRouteContent = jest.fn(() => <div data-testid="route-content" />);

const selectedAccount: SelectedAccountLoaded = {
    status: 'loaded',
    account: mockWalletAccount({ symbol: asNetworkSymbol('btc') }),
    network: getNetwork(asNetworkSymbol('btc')),
    params: { symbol: asNetworkSymbol('btc'), accountIndex: 0, accountType: 'normal' },
};

const renderLayout = (routeName: PageName, canSignTransaction: boolean) => {
    mockCapabilities.mockReturnValue({
        canSignTransaction,
        canConfirmAddress: canSignTransaction,
    });
    const state: AppState = {
        ...mockInitialAppState,
        wallet: {
            ...mockInitialAppState.wallet,
            accounts: [selectedAccount.account],
            selectedAccount,
        },
        router: {
            ...mockInitialAppState.router,
            app: 'wallet',
            route: { name: routeName, pattern: '/accounts', app: 'wallet' },
        },
    };
    const root = createTestCompositionRoot({
        extra: { services: { analytics: mockDesktopAnalytics() } },
        preloadedState: state,
    });
    const RouteContent = mockRouteContent;

    renderWithProviders(
        root,
        <StyleSheetManager target={document.createElement('div')}>
            <WalletLayout title="TR_NAV_SEND" account={selectedAccount}>
                <RouteContent />
            </WalletLayout>
        </StyleSheetManager>,
    );
};

describe(WalletLayout.name, () => {
    beforeEach(() => jest.clearAllMocks());

    it.each<PageName>(['wallet-send', 'wallet-staking'])(
        'does not mount the spending body for a public discovery account on %s',
        routeName => {
            renderLayout(routeName, false);

            expect(mockRouteContent).not.toHaveBeenCalled();
            expect(screen.queryByTestId('route-content')).not.toBeInTheDocument();
            expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
        },
    );

    it.each<PageName>(['wallet-send', 'wallet-staking'])(
        'preserves the existing body for a signing account on %s',
        routeName => {
            renderLayout(routeName, true);

            expect(mockRouteContent).toHaveBeenCalled();
            expect(screen.getByTestId('route-content')).toBeInTheDocument();
            expect(screen.queryByText('Public account discovery only')).not.toBeInTheDocument();
        },
    );

    it('keeps public receive content available for a discovery account', () => {
        renderLayout('wallet-receive', false);

        expect(mockRouteContent).toHaveBeenCalled();
        expect(screen.getByTestId('route-content')).toBeInTheDocument();
        expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
    });
});
