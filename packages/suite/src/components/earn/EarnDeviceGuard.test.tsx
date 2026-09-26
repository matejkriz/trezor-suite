import '@suite-common/test-utils/globalOverrides';

import { type ComponentType } from 'react';

import { screen } from '@testing-library/react';
import { StyleSheetManager } from 'styled-components';

import {
    type PageName,
    type Route,
    type SuiteRouterHistoryDep,
    getRoute,
    suiteRoutes,
} from '@suite/router';
import { createMockDeps } from '@suite-common/dependency-injection';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import {
    type WalletDeviceOperations,
    type WalletDeviceServiceDep,
} from '@suite-common/wallet-core';
import { type Account } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { AppRouter } from 'src/components/suite/AppRouter';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { EarnDeviceGuard } from './EarnDeviceGuard';
import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

jest.mock('src/support/suite/styles/GlobalStyle', () => ({
    __esModule: true,
    default: () => null,
}));

const device = mockSuiteDevice({ state: { staticSessionId: 'discoverywallet@device:0' } });
const deviceState = device.state?.staticSessionId;
if (!deviceState) throw new Error('Expected a wallet state in the device fixture');
const btcAccount = mockWalletAccount({
    symbol: asNetworkSymbol('btc'),
    deviceState,
    path: "m/84'/0'/0'",
});
const ethAccount = mockWalletAccount({ symbol: asNetworkSymbol('eth'), deviceState });
const tronAccount = mockWalletAccount({ symbol: asNetworkSymbol('trx'), deviceState });
const publicAccounts = [btcAccount, ethAccount, tronAccount];
const mockRouteContent = jest.fn(() => <div data-testid="earn-content" />);
const components = Object.fromEntries(
    suiteRoutes.map(route => [route.name, mockRouteContent]),
) as Record<PageName, ComponentType>;

const createOperations = (canSignAccount: (account: Account) => boolean) =>
    createMockDeps<WalletDeviceOperations>({
        confirmAddress: null,
        signTransaction: null,
        getAccountCapabilities: account => ({
            canSignTransaction: canSignAccount(account),
            canConfirmAddress: canSignAccount(account),
        }),
    });

const renderEarn = (
    operations?: WalletDeviceOperations,
    accounts: Account[] = [],
    routeName?: Route['name'],
) => {
    const route = routeName ? getRoute(routeName) : undefined;
    if (routeName && !route) throw new Error('Expected a configured test route');
    const services = createMockDeps<WalletDeviceServiceDep & SuiteRouterHistoryDep>({
        walletDeviceService: { get: () => operations, cancelAction: null, disconnect: null },
        suiteRouterHistory: {
            getLocation: () => ({ pathname: '/earn', search: '', hash: '' }),
            listen: null,
            navigate: null,
        },
    });
    const root = createTestCompositionRoot({
        extra: { services },
        preloadedState: {
            ...mockInitialAppState,
            device: { ...mockInitialAppState.device, selectedDevice: device, devices: [device] },
            wallet: { ...mockInitialAppState.wallet, accounts },
            router: { ...mockInitialAppState.router, route, app: route?.app ?? 'earn' },
        },
    });
    const RouteContent = mockRouteContent;

    renderWithProviders(
        root,
        <StyleSheetManager target={document.createElement('div')}>
            {routeName ? (
                <AppRouter components={components} />
            ) : (
                <EarnDeviceGuard>
                    <RouteContent />
                </EarnDeviceGuard>
            )}
        </StyleSheetManager>,
    );

    return services;
};

describe(EarnDeviceGuard.name, () => {
    beforeEach(() => jest.clearAllMocks());

    it('preserves Earn for a Trezor wallet without discovered accounts', () => {
        renderEarn();

        expect(screen.getByTestId('earn-content')).toBeInTheDocument();
        expect(mockRouteContent).toHaveBeenCalled();
    });

    it('blocks public ETH/TRX discovery accounts even when Bitcoin can sign', () => {
        const services = renderEarn(
            createOperations(account => account.symbol === 'btc'),
            publicAccounts,
        );

        expect(mockRouteContent).not.toHaveBeenCalled();
        expect(screen.queryByTestId('earn-content')).not.toBeInTheDocument();
        expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
        expect(services.walletDeviceService.get).toHaveBeenCalledWith(device);
    });

    it('permits an adapter that can sign an eligible Ethereum account', () => {
        renderEarn(
            createOperations(account => account.symbol === 'eth'),
            publicAccounts,
        );

        expect(screen.getByTestId('earn-content')).toBeInTheDocument();
        expect(mockRouteContent).toHaveBeenCalled();
    });

    it('preserves direct Earn routes for Trezor devices without capability overrides', () => {
        renderEarn(undefined, [], 'earn-tron-stake');

        expect(screen.getByTestId('earn-content')).toBeInTheDocument();
        expect(mockRouteContent).toHaveBeenCalled();
    });

    it('guards the resolved Earn background behind a foreground app', () => {
        renderEarn(
            createOperations(account => account.symbol === 'btc'),
            publicAccounts,
            'suite-start',
        );

        expect(mockRouteContent).not.toHaveBeenCalled();
        expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
    });

    it('does not use a signing account belonging to another wallet to unlock Earn', () => {
        const foreignAccount = mockWalletAccount({
            symbol: asNetworkSymbol('eth'),
            deviceState: 'otherwallet@device:0',
        });
        renderEarn(
            createOperations(account => account.deviceState === foreignAccount.deviceState),
            [...publicAccounts, foreignAccount],
        );

        expect(mockRouteContent).not.toHaveBeenCalled();
        expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
    });

    it.each<PageName>([
        'suite-earn',
        'earn-tron-stake',
        'earn-tron-unstake',
        'earn-yield-deposit',
        'earn-yield-claim',
    ])('does not mount the resolved %s route for public discovery accounts', routeName => {
        renderEarn(
            createOperations(account => account.symbol === 'btc'),
            publicAccounts,
            routeName,
        );

        expect(mockRouteContent).not.toHaveBeenCalled();
        expect(screen.queryByTestId('earn-content')).not.toBeInTheDocument();
        expect(screen.getByText('Public account discovery only')).toBeInTheDocument();
    });
});
