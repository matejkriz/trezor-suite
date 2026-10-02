import { createMockDeps } from '@suite-common/dependency-injection';
import { deviceActions, deviceInitialState } from '@suite-common/device';
import { type LedgerDevice, getLedgerDiscoveryPath } from '@suite-common/ledger';
import { createMockDispatch } from '@suite-common/redux-utils/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import TrezorConnect, {
    type AccountInfo,
    type GetAccountInfo,
    type Params,
    type Response,
} from '@trezor/connect';
import { bip32 } from '@trezor/utxo-lib';

import {
    type ConnectLedgerBitcoinWalletThunkDeps,
    type ConnectLedgerBitcoinWalletThunkState,
    connectLedgerBitcoinWalletThunk,
} from './connectLedgerBitcoinWalletThunk';
import { accountsActions } from '../accounts/accountsActions';
import { discoveryActions } from '../discovery/discoveryActions';
import { initialWalletSettingsState } from '../settings/walletSettingsReducer';

const device = { id: 'transient-ble-id', name: 'My travel wallet' } as LedgerDevice;
const ledgerAccount = {
    path: "84'/0'/0'",
    extendedPublicKey: 'xpub-test',
    descriptor: 'zpubtest',
    masterFingerprint: '1234abcd',
    address: 'bc1q-test',
};
const accountInfo = {
    descriptor: ledgerAccount.descriptor,
    empty: true,
    balance: '0',
    availableBalance: '0',
    history: { total: 0, unconfirmed: 0 },
    addresses: { used: [], unused: [], change: [] },
    utxo: [],
    tokens: [],
} as AccountInfo;
const accountInfoClient: {
    getAccountInfo: (params: Params<GetAccountInfo>) => Response<AccountInfo>;
} = TrezorConnect;

const prepareTest = () => {
    const extra = createMockDeps<ConnectLedgerBitcoinWalletThunkDeps>({
        services: {
            ledgerBitcoinService: {
                connect: () => Promise.resolve(),
                isConnectionOwner: () => true,
                getAccount: () => Promise.resolve(ledgerAccount),
                getDeviceInfo: () => ({ name: 'My travel wallet', model: 'Ledger Flex' }),
                disconnect: () => Promise.resolve(),
                stopDiscovery: () => Promise.resolve(),
                dispose: null,
                listenToAvailableDevices: null,
                startDiscovery: null,
                getMasterFingerprint: null,
                hasAccountsDiscovery: () => Promise.resolve(false),
                openAccountsDiscovery: () =>
                    Promise.resolve({
                        getInfo: () =>
                            Promise.resolve({
                                protocolVersion: 1,
                                appVersion: '0.1.0',
                                maxBatch: 3,
                                profiles: [3, 15],
                            }),
                        open: () => Promise.resolve(),
                        close: () => Promise.resolve(),
                        readPublicKeys: requests =>
                            Promise.resolve(
                                requests.map(request => {
                                    const path = getLedgerDiscoveryPath(request);
                                    if (!path) throw new Error('Invalid fixture');
                                    const node = bip32
                                        .fromSeed(Buffer.alloc(32, 7))
                                        .derivePath(path);
                                    const parentFingerprint = Buffer.alloc(4);
                                    parentFingerprint.writeUInt32BE(node.parentFingerprint);

                                    return {
                                        ...request,
                                        publicKey: node.publicKey,
                                        chainCode: node.chainCode,
                                        parentFingerprint,
                                        childIndex: node.index,
                                        depth: node.depth,
                                    };
                                }),
                            ),
                    }),
                verifyAddress: null,
                signPsbt: null,
                signTransaction: null,
                cancelAction: null,
            },
        },
    });
    const state: ConnectLedgerBitcoinWalletThunkState = {
        device: deviceInitialState,
        wallet: { accounts: [], settings: { ...initialWalletSettingsState } },
    };
    const getState = () => state;
    const { actions, dispatch } = createMockDispatch({ getState, extra });

    return { extra, actions, dispatch, state, service: extra.services.ledgerBitcoinService };
};

describe(connectLedgerBitcoinWalletThunk.name, () => {
    beforeEach(() => {
        const getAccountInfo = jest.spyOn(accountInfoClient, 'getAccountInfo');
        getAccountInfo.mockResolvedValue({
            success: true,
            payload: accountInfo,
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it('adds a Bluetooth Ledger to the regular devices and accounts with completed discovery', async () => {
        const { actions, dispatch } = prepareTest();
        const connectedDevice = await dispatch(
            connectLedgerBitcoinWalletThunk({ device, apiType: 'bluetooth' }),
        ).unwrap();

        expect(connectedDevice.descriptor.apiType).toBe('bluetooth');
        expect(connectedDevice.features.label).toBe('My travel wallet');
        expect(actions).toEqual(
            expect.arrayContaining([
                deviceActions.connectLedgerDevice(connectedDevice),
                expect.objectContaining({ type: accountsActions.createAccount.type }),
                discoveryActions.startDiscovery(connectedDevice.path),
                discoveryActions.updateDiscovery({ status: 'complete' }, connectedDevice.path),
                deviceActions.selectDevice(connectedDevice),
            ]),
        );
        expect(actions.findIndex(deviceActions.selectDevice.match)).toBeGreaterThan(
            actions.findIndex(discoveryActions.updateDiscovery.match),
        );
    });

    it('uses Accounts Discovery for enabled ETH while keeping a Bitcoin-derived wallet identity', async () => {
        const { actions, dispatch, state, service } = prepareTest();
        state.wallet.settings.enabledNetworks = [asNetworkSymbol('eth')];
        jest.spyOn(accountInfoClient, 'getAccountInfo').mockImplementation(params =>
            Promise.resolve({
                success: true,
                payload: { ...accountInfo, descriptor: params.descriptor ?? '' },
            }),
        );
        const connected = await dispatch(
            connectLedgerBitcoinWalletThunk({ device, useAccountsDiscovery: true }),
        ).unwrap();
        expect(service.connect).toHaveBeenCalledTimes(1);
        expect(service.getAccount).not.toHaveBeenCalled();
        expect(service.openAccountsDiscovery).toHaveBeenCalledTimes(1);
        expect(connected.ledgerInfo?.accountsDiscoveryAppVersion).toBe('0.1.0');
        expect(connected.unavailableCapabilities.eth).toBeUndefined();
        expect(
            actions
                .filter(accountsActions.createAccount.match)
                .map(action => action.payload.account.symbol),
        ).toEqual(['eth']);
        expect(accountInfoClient.getAccountInfo).toHaveBeenCalledWith(
            expect.objectContaining({ coin: 'eth' }),
        );
        expect(accountInfoClient.getAccountInfo).not.toHaveBeenCalledWith(
            expect.objectContaining({ coin: 'btc' }),
        );
        expect(actions.filter(deviceActions.selectDevice.match)).toHaveLength(1);
    });

    it('rejects a different wallet during reconnection before adding device or accounts', async () => {
        const { actions, dispatch, service } = prepareTest();
        await expect(
            dispatch(
                connectLedgerBitcoinWalletThunk({ device, expectedDeviceId: 'another-wallet' }),
            ).unwrap(),
        ).rejects.toBe('Connect the same Ledger wallet to continue');

        expect(actions).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: deviceActions.connectLedgerDevice.type }),
            ]),
        );
        expect(service.disconnect).toHaveBeenCalled();
    });

    it('does not insert a device when canceled while connecting', async () => {
        let finishConnect: () => void = () => undefined;
        const { actions, dispatch, service } = prepareTest();
        service.connect.mockImplementation(
            () =>
                new Promise<void>(resolve => {
                    finishConnect = resolve;
                }),
        );

        const connection = dispatch(connectLedgerBitcoinWalletThunk({ device }));
        connection.abort();
        finishConnect();
        await connection;

        expect(actions).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: deviceActions.connectLedgerDevice.type }),
            ]),
        );
        expect(service.disconnect).toHaveBeenCalled();
        expect(service.getAccount).not.toHaveBeenCalled();
    });

    it('does not place raw SDK or backend error details in Redux rejected actions', async () => {
        const { actions, dispatch, service } = prepareTest();
        service.getAccount.mockRejectedValue(new Error('confidential device label'));

        await expect(dispatch(connectLedgerBitcoinWalletThunk({ device })).unwrap()).rejects.toBe(
            'Ledger connection failed',
        );
        expect(JSON.stringify(actions)).not.toContain('confidential device label');
        expect(service.disconnect).toHaveBeenCalled();
    });

    it('does not insert a connected wallet if its session disconnects during the last backend query', async () => {
        const { actions, dispatch, service } = prepareTest();
        let finishBackend: (response: Awaited<Response<AccountInfo>>) => void = () => undefined;
        let markBackendRequested: () => void = () => undefined;
        const backendRequested = new Promise<void>(resolve => {
            markBackendRequested = resolve;
        });
        jest.spyOn(accountInfoClient, 'getAccountInfo').mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishBackend = resolve;
                    markBackendRequested();
                }),
        );

        const connection = dispatch(connectLedgerBitcoinWalletThunk({ device }));
        await backendRequested;
        service.isConnectionOwner.mockReturnValue(false);
        finishBackend({ success: true, payload: accountInfo });
        await expect(connection.unwrap()).rejects.toBe('Ledger connection failed');

        expect(actions.filter(deviceActions.connectLedgerDevice.match)).toHaveLength(0);
        expect(actions.filter(accountsActions.createAccount.match)).toHaveLength(0);
    });

    it('does not disconnect a new connection when canceled discovery completes late', async () => {
        const { dispatch, service } = prepareTest();
        let finishFirstAccount: (account: typeof ledgerAccount) => void = () => undefined;
        let markAccountRequested: () => void = () => undefined;
        const accountRequested = new Promise<void>(resolve => {
            markAccountRequested = resolve;
        });
        service.getAccount.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishFirstAccount = resolve;
                    markAccountRequested();
                }),
        );

        const first = dispatch(connectLedgerBitcoinWalletThunk({ device }));
        await accountRequested;
        first.abort();
        await first;
        await dispatch(connectLedgerBitcoinWalletThunk({ device })).unwrap();
        finishFirstAccount(ledgerAccount);
        await Promise.resolve();
        await Promise.resolve();

        expect(service.disconnect).toHaveBeenCalledTimes(1);
    });

    it.each(['completion', 'cancellation'] as const)(
        'keeps the newest acquisition when an older attempt settles by late %s',
        async outcome => {
            const { actions, dispatch, service } = prepareTest();
            let currentOwner: string | undefined;
            const disconnectedOwners: string[] = [];
            service.connect.mockImplementation((_device, options) => {
                currentOwner = options?.owner;

                return Promise.resolve();
            });
            service.isConnectionOwner.mockImplementation(owner => owner === currentOwner);
            service.disconnect.mockImplementation(options => {
                if (options?.owner === currentOwner && currentOwner) {
                    disconnectedOwners.push(currentOwner);
                    currentOwner = undefined;
                }

                return Promise.resolve();
            });
            let finishFirstAccount: (account: typeof ledgerAccount) => void = () => undefined;
            let markAccountRequested: () => void = () => undefined;
            const accountRequested = new Promise<void>(resolve => {
                markAccountRequested = resolve;
            });
            service.getAccount.mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        finishFirstAccount = resolve;
                        markAccountRequested();
                    }),
            );

            const first = dispatch(connectLedgerBitcoinWalletThunk({ device }));
            await accountRequested;
            const second = dispatch(connectLedgerBitcoinWalletThunk({ device }));
            await second.unwrap();
            if (outcome === 'cancellation') first.abort();
            finishFirstAccount(ledgerAccount);
            const firstResult = await first;
            await Promise.resolve();

            expect(connectLedgerBitcoinWalletThunk.rejected.match(firstResult)).toBe(true);
            expect(currentOwner).toBe(second.requestId);
            expect(disconnectedOwners).toEqual([]);
            expect(actions.filter(deviceActions.connectLedgerDevice.match)).toHaveLength(1);
            expect(service.connect).toHaveBeenNthCalledWith(1, device, { owner: first.requestId });
            expect(service.connect).toHaveBeenNthCalledWith(2, device, { owner: second.requestId });
        },
    );
});
