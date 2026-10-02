import { type AnalyticsSharedEvents } from '@suite-common/analytics';
import { createMockDeps } from '@suite-common/dependency-injection';
import { mockNetworksState } from '@suite-common/networks/mocks';
import { persistentDeviceDataInitialState } from '@suite-common/persistent-device-data';
import { createMockDispatch } from '@suite-common/redux-utils/mocks';
import { tokenDefinitionsInitialState } from '@suite-common/token-definitions';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockGetTradedAccountKeys, mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { mockAnalytics } from '@trezor/analytics-uploader/mocks';
import TrezorConnect from '@trezor/connect';
import { createDeferred } from '@trezor/utils';

import { prepareDiscoveryReducer } from './discoveryReducer';
import {
    type RunDiscoveryThunkDeps,
    type RunDiscoveryThunkState,
    cancelDiscoveryThunk,
    runAdditionalDiscoveryThunk,
    startDiscoveryThunk,
    startOrRestartDiscoveryThunk,
} from './discoveryThunks';
import { accountsActions } from '../accounts/accountsActions';
import { blockchainInitialState } from '../blockchain/blockchainReducer';
import { createLedgerSuiteDevice } from '../ledger/createLedgerSuiteDevice';
import { selectShouldRediscover } from '../selectors';
import { initialWalletSettingsState } from '../settings/walletSettingsReducer';
import { WalletDeviceActionError } from '../wallet-device/walletDeviceError';
import {
    type WalletDeviceOperations,
    type WalletDeviceServiceDep,
} from '../wallet-device/walletDeviceTypes';

const eth = asNetworkSymbol('eth');
const btc = asNetworkSymbol('btc');
const device = createLedgerSuiteDevice({
    id: 'testwallet',
    label: 'Test wallet',
    staticSessionId: 'testwallet@ledger:0',
    sessionId: 'connection-owner',
    supportedNetworks: [btc, eth],
    accountsDiscoveryAppVersion: '0.1.0',
});
const accountInfo = {
    descriptor: '0x1234',
    empty: true,
    balance: '0',
    availableBalance: '0',
    history: { total: 0, unconfirmed: 0 },
};
const discoveredAccounts = [
    {
        symbol: eth,
        index: 0,
        path: "m/44'/60'/0'/0/0" as const,
        accountType: 'normal' as const,
        accountInfo,
        visible: true,
    },
];

const prepareTest = () => {
    const state: RunDiscoveryThunkState = {
        device: { devices: [device], selectedDevice: device },
        networks: mockNetworksState([btc, eth]),
        persistentDeviceData: persistentDeviceDataInitialState,
        tokenDefinitions: tokenDefinitionsInitialState,
        wallet: {
            accounts: [
                mockWalletAccount({ symbol: btc, deviceState: device.state.staticSessionId }),
            ],
            blockchain: blockchainInitialState,
            discovery: { [device.path]: { status: 'complete' } },
            settings: { ...initialWalletSettingsState, enabledNetworks: [btc, eth] },
        },
    };
    const operations = createMockDeps<WalletDeviceOperations>({
        discoverAccounts: () =>
            Promise.resolve({ accounts: discoveredAccounts, failedNetworks: [] }),
        getAccountCapabilities: undefined,
        confirmAddress: null,
        signTransaction: null,
    });
    const services = createMockDeps<WalletDeviceServiceDep>({
        walletDeviceService: {
            get: () => operations,
            cancelAction: () => Promise.resolve(),
            disconnect: null,
        },
    });
    const extra: RunDiscoveryThunkDeps = {
        services: {
            analytics: mockAnalytics<AnalyticsSharedEvents>(),
            getTradedAccountKeys: mockGetTradedAccountKeys(),
            walletDeviceService: services.walletDeviceService,
        },
        thunks: { fetchAndSaveMetadata: jest.fn() },
    };
    const discoveryReducer = prepareDiscoveryReducer(undefined);
    const mockDispatch = createMockDispatch({ getState: () => state, extra });
    const subscription = mockDispatch.onDispatch(action => {
        state.wallet.discovery = discoveryReducer(state.wallet.discovery, action);
        if (accountsActions.createAccount.match(action))
            state.wallet.accounts.push(action.payload.account);
    });

    return { state, extra, operations, ...mockDispatch, dispose: subscription.unsubscribe };
};

describe('wallet device discovery through the regular discovery flow', () => {
    afterEach(() => jest.restoreAllMocks());

    it('discovers enabled Ethereum from Load networks without sending device calls to Connect', async () => {
        const { state, actions, dispatch, operations, dispose } = prepareTest();
        const getDeviceState = jest.spyOn(TrezorConnect, 'getDeviceState');
        const discoverAccounts = jest.spyOn(TrezorConnect, 'discoverAccounts');
        await dispatch(startOrRestartDiscoveryThunk());
        dispose();

        expect(operations.discoverAccounts).toHaveBeenCalledWith(
            expect.objectContaining({ networkSymbols: [btc, eth] }),
        );
        expect(state.wallet.accounts.map(account => account.symbol)).toEqual([btc, eth]);
        expect(state.wallet.accounts[1]?.deviceState).toBe(device.state.staticSessionId);
        expect(state.wallet.discovery[device.path]?.status).toBe('complete');
        expect(actions).toContainEqual(
            expect.objectContaining({ type: accountsActions.createAccount.type }),
        );
        expect(getDeviceState).not.toHaveBeenCalled();
        expect(discoverAccounts).not.toHaveBeenCalled();
    });

    it('allows automatic discovery when an enabled supported network has no account', () => {
        const { state, dispose } = prepareTest();
        dispose();
        expect(selectShouldRediscover(state, device)).toBe(true);
    });

    it('routes initial discovery through the same device provider', async () => {
        const { dispatch, operations, dispose } = prepareTest();
        await dispatch(startDiscoveryThunk({ device }));
        dispose();
        expect(operations.discoverAccounts).toHaveBeenCalledTimes(1);
    });

    it.each(['cancelled', 'rejected'] as const)(
        'keeps device %s semantics during discovery',
        async kind => {
            const { state, dispatch, operations, dispose } = prepareTest();
            operations.discoverAccounts.mockRejectedValue(new WalletDeviceActionError(kind));
            await dispatch(startOrRestartDiscoveryThunk());
            dispose();
            expect(state.wallet.discovery[device.path]?.status).toBe('cancelled');
            expect(state.wallet.accounts).toHaveLength(1);
        },
    );

    it('marks a partial backend failure as failed while keeping successfully discovered accounts', async () => {
        const { state, dispatch, operations, dispose } = prepareTest();
        operations.discoverAccounts.mockResolvedValue({
            accounts: discoveredAccounts,
            failedNetworks: [btc],
        });
        await dispatch(startOrRestartDiscoveryThunk());
        dispose();
        expect(state.wallet.accounts.map(account => account.symbol)).toEqual([btc, eth]);
        expect(state.wallet.discovery[device.path]).toMatchObject({
            status: 'failed',
            error: 'Some enabled networks could not be discovered. Please try again.',
        });
    });

    it('does not finish or add accounts after discovery is cancelled', async () => {
        const { state, dispatch, operations, extra, dispose } = prepareTest();
        const pending = createDeferred<{
            accounts: typeof discoveredAccounts;
            failedNetworks: [];
        }>();
        operations.discoverAccounts.mockReturnValue(pending.promise);
        const discovery = dispatch(runAdditionalDiscoveryThunk(device.state.staticSessionId));
        await dispatch(cancelDiscoveryThunk(device));
        pending.resolve({ accounts: discoveredAccounts, failedNetworks: [] });
        await discovery;
        dispose();
        expect(extra.services.walletDeviceService.cancelAction).toHaveBeenCalledWith({
            device,
            reason: { reason: 'USER_UI_CANCEL' },
        });
        expect(state.wallet.discovery[device.path]?.status).toBe('cancelled');
        expect(state.wallet.accounts).toHaveLength(1);
    });

    it('does not start a duplicate discovery while the first run is still active', async () => {
        const { dispatch, operations, dispose } = prepareTest();
        const pending = createDeferred<{
            accounts: typeof discoveredAccounts;
            failedNetworks: [];
        }>();
        operations.discoverAccounts.mockReturnValue(pending.promise);
        const first = dispatch(startOrRestartDiscoveryThunk());
        await dispatch(startOrRestartDiscoveryThunk());
        pending.resolve({ accounts: discoveredAccounts, failedNetworks: [] });
        await first;
        dispose();
        expect(operations.discoverAccounts).toHaveBeenCalledTimes(1);
    });

    it('ignores a late result from a superseded discovery', async () => {
        const { state, dispatch, operations, dispose } = prepareTest();
        const pending = createDeferred<{
            accounts: typeof discoveredAccounts;
            failedNetworks: [];
        }>();
        operations.discoverAccounts.mockReturnValueOnce(pending.promise);
        const first = dispatch(runAdditionalDiscoveryThunk(device.state.staticSessionId));
        await dispatch(runAdditionalDiscoveryThunk(device.state.staticSessionId));
        pending.resolve({ accounts: discoveredAccounts, failedNetworks: [] });
        await first;
        dispose();
        expect(state.wallet.accounts.map(account => account.symbol)).toEqual([btc, eth]);
        expect(state.wallet.discovery[device.path]?.status).toBe('complete');
    });

    it('cancels an aborted discovery and ignores a backend that finishes later', async () => {
        const { state, dispatch, operations, extra, dispose } = prepareTest();
        const pending = createDeferred<{
            accounts: typeof discoveredAccounts;
            failedNetworks: [];
        }>();
        operations.discoverAccounts.mockReturnValue(pending.promise);
        const discovery = dispatch(runAdditionalDiscoveryThunk(device.state.staticSessionId));
        discovery.abort();
        await discovery;
        pending.resolve({ accounts: discoveredAccounts, failedNetworks: [] });
        dispose();
        expect(state.wallet.discovery[device.path]?.status).toBe('cancelled');
        expect(state.wallet.accounts).toHaveLength(1);
        expect(extra.services.walletDeviceService.cancelAction).toHaveBeenCalledTimes(1);
    });

    it('keeps account labels, metadata and hidden visibility when retrying discovery', async () => {
        const { state, actions, dispatch, dispose } = prepareTest();
        const existing = mockWalletAccount({
            symbol: eth,
            descriptor: asAccountDescriptor(accountInfo.descriptor),
            deviceState: device.state.staticSessionId,
            index: 0,
            accountType: 'normal',
            path: "m/44'/60'/0'/0/0",
            visible: false,
            accountLabel: 'My savings',
            metadata: { key: 'local-labels' },
        });
        state.wallet.accounts.push(existing);
        await dispatch(startOrRestartDiscoveryThunk());
        dispose();
        expect(state.wallet.accounts).toHaveLength(2);
        expect(actions.filter(accountsActions.createAccount.match)).toHaveLength(0);
        expect(
            actions.filter(accountsActions.updateAccount.match)[0]?.payload.account,
        ).toMatchObject({
            accountLabel: existing.accountLabel,
            metadata: existing.metadata,
            visible: false,
        });
    });
});
