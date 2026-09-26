import { createMockDeps } from '@suite-common/dependency-injection';
import {
    type LedgerDevice,
    getLedgerDiscoveryPath,
    getLedgerWalletIdentity,
    serializeLedgerDiscoveryKey,
} from '@suite-common/ledger';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { bip32 } from '@trezor/utxo-lib';

import {
    type DiscoverLedgerWalletWithAccountsAppDeps,
    discoverLedgerWalletWithAccountsApp,
} from './discoverLedgerWalletWithAccountsApp';

const device = { id: 'disposable-usb-id' } as LedgerDevice;
const prepareTest = () => {
    const deps = createMockDeps<DiscoverLedgerWalletWithAccountsAppDeps>({
        ledgerBitcoinService: {
            connect: () => Promise.resolve(),
            isConnectionOwner: () => true,
            getDeviceInfo: () => ({ name: 'My Ledger', model: 'Ledger Flex' }),
            openAccountsDiscovery: () =>
                Promise.resolve({
                    getInfo: () =>
                        Promise.resolve({
                            protocolVersion: 1,
                            appVersion: '0.1.0',
                            maxBatch: 3,
                            profiles: [3, 15],
                        }),
                    open: jest.fn(() => Promise.resolve()),
                    close: jest.fn(() => Promise.resolve()),
                    readPublicKeys: requests =>
                        Promise.resolve(
                            requests.map(request => {
                                const path = getLedgerDiscoveryPath(request);
                                if (!path) throw new Error('Invalid test profile');
                                const node = bip32.fromSeed(Buffer.alloc(32, 7)).derivePath(path);
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
        },
        getAccountInfo: ({ descriptor }) =>
            Promise.resolve({
                success: true,
                payload: {
                    descriptor,
                    empty: true,
                    balance: '0',
                    availableBalance: '0',
                    history: { total: 0, unconfirmed: 0 },
                },
            }),
    });

    return deps;
};

describe(discoverLedgerWalletWithAccountsApp.name, () => {
    it('connects the injected service once and binds BTC and ETH to the same stable Suite identity', async () => {
        const deps = prepareTest();
        const result = await discoverLedgerWalletWithAccountsApp(deps, device, {
            owner: 'acquisition-a',
            networkSymbols: ['btc', 'eth', 'ada'].map(asNetworkSymbol),
        });
        expect(deps.ledgerBitcoinService.connect).toHaveBeenCalledWith(device, {
            owner: 'acquisition-a',
        });
        expect(deps.ledgerBitcoinService.openAccountsDiscovery).toHaveBeenCalledTimes(1);
        expect(result.accounts.map(account => account.symbol)).toEqual(['btc', 'eth']);
        const opening = deps.ledgerBitcoinService.openAccountsDiscovery.mock.results[0];
        if (!opening) throw new Error('Missing opened test client');
        const client = await opening.value;
        const bitcoinKey = (await client.readPublicKeys([{ profile: 3, account: 0 }]))[0];
        const serialized = serializeLedgerDiscoveryKey(bitcoinKey);
        if (!serialized.success) throw new Error('Invalid test key');
        expect(result.wallet).toMatchObject({
            id: getLedgerWalletIdentity(serialized.payload.descriptor),
            label: 'My Ledger',
            sessionId: 'acquisition-a',
            supportedNetworks: expect.arrayContaining(['btc', 'eth']),
            accountsDiscoveryAppVersion: '0.1.0',
        });
        expect(client.open).toHaveBeenCalledTimes(1);
        expect(client.close).toHaveBeenCalledTimes(1);
    });

    it('does not open the app on a superseded connection', async () => {
        const deps = prepareTest();
        deps.ledgerBitcoinService.isConnectionOwner.mockReturnValue(false);
        await expect(
            discoverLedgerWalletWithAccountsApp(deps, device, {
                owner: 'old-owner',
                networkSymbols: ['btc', 'eth'].map(asNetworkSymbol),
            }),
        ).rejects.toThrow('canceled');
        expect(deps.ledgerBitcoinService.openAccountsDiscovery).not.toHaveBeenCalled();
    });

    it('does not commit an empty discovery when all selected backends fail', async () => {
        const deps = prepareTest();
        deps.getAccountInfo.mockResolvedValue({
            success: false,
            error: { message: 'private request URL' },
        });
        await expect(
            discoverLedgerWalletWithAccountsApp(deps, device, {
                networkSymbols: ['btc', 'eth'].map(asNetworkSymbol),
            }),
        ).rejects.toThrow('No Ledger accounts could be discovered');
    });
});
