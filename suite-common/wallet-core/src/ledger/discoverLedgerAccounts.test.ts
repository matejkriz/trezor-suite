import { createMockDeps } from '@suite-common/dependency-injection';
import {
    type LedgerDiscoveryKeyRequest,
    type LedgerDiscoveryPublicKey,
    getLedgerDiscoveryPath,
    serializeLedgerDiscoveryKey,
} from '@suite-common/ledger';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type AccountInfo } from '@trezor/connect';
import { bip32 } from '@trezor/utxo-lib';

import { type DiscoverLedgerAccountsDeps, discoverLedgerAccounts } from './discoverLedgerAccounts';

const createKey = (request: LedgerDiscoveryKeyRequest): LedgerDiscoveryPublicKey => {
    const path = getLedgerDiscoveryPath(request);
    if (!path) throw new Error('Missing fixture path');
    if (request.profile >= 22) {
        const parts = path.slice(2).split('/');
        const child = parts.at(-1);
        if (!child) throw new Error('Missing fixture child');

        return {
            ...request,
            publicKey: Buffer.from(
                'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
                'hex',
            ),
            chainCode: new Uint8Array(32),
            parentFingerprint: new Uint8Array(4),
            childIndex: Number.parseInt(child, 10) + (child.endsWith("'") ? 0x80000000 : 0),
            depth: parts.length,
        };
    }
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
};

const createAccountInfo = (descriptor: string, empty = true): AccountInfo => ({
    descriptor,
    empty,
    balance: '0',
    availableBalance: '0',
    history: { total: empty ? 0 : 1, unconfirmed: 0 },
});

const prepareTest = (profiles = [1, 2, 3, 4, 15, 16, 17]) =>
    createMockDeps<DiscoverLedgerAccountsDeps>({
        accountsDiscoveryService: {
            getInfo: () =>
                Promise.resolve({ protocolVersion: 1, appVersion: '0.1.0', maxBatch: 3, profiles }),
            open: () => Promise.resolve(),
            readPublicKeys: requests => Promise.resolve(requests.map(createKey)),
            close: () => Promise.resolve(),
        },
        getAccountInfo: ({ descriptor }) =>
            Promise.resolve({ success: true, payload: createAccountInfo(descriptor) }),
        isCurrentConnection: () => true,
    });

describe(discoverLedgerAccounts.name, () => {
    it('opens one app session for BTC and ETH, deduplicates the shared first ETH address and closes it', async () => {
        const deps = prepareTest();
        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['btc', 'eth', 'ada'].map(asNetworkSymbol),
        });
        const bitcoin = serializeLedgerDiscoveryKey(createKey({ profile: 3, account: 0 }));
        if (!bitcoin.success) throw new Error('Invalid fixture');

        expect(result.baseDescriptor).toBe(bitcoin.payload.descriptor);
        expect(result.supportedNetworks).toEqual(['btc', 'eth']);
        expect(result.skippedNetworks).toEqual(['ada']);
        expect(result.failedNetworks).toEqual([]);
        expect(result.accounts.filter(account => account.symbol === 'eth')).toHaveLength(2);
        expect(
            result.accounts.filter(account => account.visible).map(account => account.accountType),
        ).toEqual(['normal', 'normal']);
        expect(deps.accountsDiscoveryService.getInfo).toHaveBeenCalledTimes(1);
        expect(deps.accountsDiscoveryService.open).toHaveBeenCalledTimes(1);
        expect(deps.accountsDiscoveryService.close).toHaveBeenCalledTimes(1);
        expect(deps.accountsDiscoveryService.readPublicKeys).toHaveBeenCalledTimes(1);
        expect(deps.accountsDiscoveryService.readPublicKeys).toHaveBeenCalledWith(
            expect.arrayContaining([
                { profile: 3, account: 0 },
                { profile: 15, account: 0 },
            ]),
        );
        expect(
            deps.accountsDiscoveryService.readPublicKeys.mock.calls[0]?.[0].some(
                request => request.profile === 4,
            ),
        ).toBe(false);
    });

    it('continues a used BTC profile after ETH is empty, stopping each profile at its first empty account', async () => {
        const deps = prepareTest([3, 15]);
        const firstBitcoin = serializeLedgerDiscoveryKey(createKey({ profile: 3, account: 0 }));
        if (!firstBitcoin.success) throw new Error('Invalid fixture');
        deps.getAccountInfo.mockImplementation(({ descriptor }) =>
            Promise.resolve({
                success: true,
                payload: createAccountInfo(
                    descriptor,
                    descriptor !== firstBitcoin.payload.descriptor,
                ),
            }),
        );

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['btc', 'eth'].map(asNetworkSymbol),
        });

        expect(
            deps.accountsDiscoveryService.readPublicKeys.mock.calls.map(([requests]) => requests),
        ).toEqual([
            [
                { profile: 3, account: 0 },
                { profile: 15, account: 0 },
            ],
            [{ profile: 3, account: 1 }],
        ]);
        expect(result.accounts.filter(account => account.symbol === 'btc')).toMatchObject([
            { index: 0, visible: true },
            { index: 1, visible: false },
        ]);
    });

    it('derives BTC identity while only discovering ETH and ignores a BTC backend outage', async () => {
        const deps = prepareTest([3, 15]);
        deps.getAccountInfo.mockImplementation(({ symbol, descriptor }) =>
            Promise.resolve(
                symbol === 'btc'
                    ? {
                          success: false,
                          error: { message: 'Confidential backend data must not be forwarded' },
                      }
                    : { success: true, payload: createAccountInfo(descriptor) },
            ),
        );

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['btc', 'eth'].map(asNetworkSymbol),
        });
        expect(result.accounts.map(account => account.symbol)).toEqual(['eth']);
        expect(result.skippedNetworks).toEqual(['btc']);
        expect(result.failedNetworks).toEqual(['btc']);
        expect(result.baseDescriptor).toMatch(/^zpub/);

        const onlyEthereum = prepareTest([3, 15]);
        await discoverLedgerAccounts(onlyEthereum, {
            networkSymbols: ['eth'].map(asNetworkSymbol),
        });
        expect(
            onlyEthereum.getAccountInfo.mock.calls.every(([request]) => request.symbol === 'eth'),
        ).toBe(true);
        expect(onlyEthereum.accountsDiscoveryService.readPublicKeys).toHaveBeenCalledWith([
            { profile: 3, account: 0 },
            { profile: 15, account: 0 },
        ]);
    });

    it('rejects a backend returning another descriptor and still revokes app consent', async () => {
        const deps = prepareTest([3, 15]);
        deps.getAccountInfo.mockResolvedValue({
            success: true,
            payload: createAccountInfo('another-wallet'),
        });

        await expect(
            discoverLedgerAccounts(deps, { networkSymbols: ['eth'].map(asNetworkSymbol) }),
        ).rejects.toThrow('unexpected account descriptor');
        expect(deps.accountsDiscoveryService.close).toHaveBeenCalledTimes(1);
    });

    it('never resets the replacement device after connection ownership changes', async () => {
        const deps = prepareTest([3, 15]);
        deps.accountsDiscoveryService.readPublicKeys.mockImplementation(requests => {
            deps.isCurrentConnection.mockReturnValue(false);

            return Promise.resolve(requests.map(createKey));
        });

        await expect(
            discoverLedgerAccounts(deps, { networkSymbols: ['eth'].map(asNetworkSymbol) }),
        ).rejects.toThrow('canceled');
        expect(deps.getAccountInfo).not.toHaveBeenCalled();
        expect(deps.accountsDiscoveryService.close).not.toHaveBeenCalled();
    });

    it('revokes an aborted approved session and does not query any backend', async () => {
        const deps = prepareTest([3, 15]);
        const controller = new AbortController();
        deps.accountsDiscoveryService.readPublicKeys.mockImplementation(requests => {
            controller.abort();

            return Promise.resolve(requests.map(createKey));
        });

        await expect(
            discoverLedgerAccounts(deps, {
                networkSymbols: ['eth'].map(asNetworkSymbol),
                signal: controller.signal,
            }),
        ).rejects.toThrow('canceled');
        expect(deps.accountsDiscoveryService.close).toHaveBeenCalledTimes(1);
        expect(deps.getAccountInfo).not.toHaveBeenCalled();
    });

    it('requires the identity profile before requesting device permission', async () => {
        const deps = prepareTest([15]);

        await expect(
            discoverLedgerAccounts(deps, { networkSymbols: ['eth'].map(asNetworkSymbol) }),
        ).rejects.toThrow('Bitcoin identity');
        expect(deps.accountsDiscoveryService.open).not.toHaveBeenCalled();
    });

    it('keeps discovering one EVM network after another network with the same address is empty', async () => {
        const deps = prepareTest([3, 15]);
        let baseQueries = 0;
        deps.getAccountInfo.mockImplementation(({ symbol, descriptor }) => {
            if (symbol === 'base') baseQueries++;

            return Promise.resolve({
                success: true,
                payload: createAccountInfo(descriptor, symbol === 'eth' || baseQueries > 1),
            });
        });

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['eth', 'base'].map(asNetworkSymbol),
        });

        expect(result.accounts.map(account => [account.symbol, account.index])).toEqual([
            ['eth', 0],
            ['base', 0],
            ['base', 1],
        ]);
        expect(
            deps.getAccountInfo.mock.calls.filter(([request]) => request.symbol === 'eth'),
        ).toHaveLength(1);
        expect(
            deps.getAccountInfo.mock.calls.filter(([request]) => request.symbol === 'base'),
        ).toHaveLength(2);
    });

    it('queries the Solana root only once while another used profile continues', async () => {
        const deps = prepareTest([3, 15, 24]);
        const ethereum = serializeLedgerDiscoveryKey(createKey({ profile: 15, account: 0 }));
        if (!ethereum.success) throw new Error('Invalid fixture');
        deps.getAccountInfo.mockImplementation(({ descriptor }) =>
            Promise.resolve({
                success: true,
                payload: createAccountInfo(descriptor, descriptor !== ethereum.payload.descriptor),
            }),
        );

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['eth', 'sol'].map(asNetworkSymbol),
        });

        expect(result.accounts.find(account => account.symbol === 'sol')).toMatchObject({
            path: "m/44'/501'",
            index: 0,
            accountType: 'root',
        });
        expect(
            deps.accountsDiscoveryService.readPublicKeys.mock.calls
                .flatMap(([requests]) => requests)
                .filter(request => request.profile === 24),
        ).toEqual([{ profile: 24, account: 0 }]);
    });

    it('retains all metadata-supported networks when only ETH was enabled during discovery', async () => {
        const deps = prepareTest([3, 15]);
        deps.getAccountInfo.mockResolvedValue({
            success: false,
            error: { message: 'Backend temporarily unavailable' },
        });

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: [asNetworkSymbol('eth')],
        });

        expect(result.supportedNetworks).toEqual(['eth']);
        expect(result.skippedNetworks).toEqual(['eth']);
        expect(result.availableNetworks).toEqual([
            'btc',
            'eth',
            'pol',
            'bsc',
            'arb',
            'base',
            'op',
            'rhc',
            'hype',
            'avax',
            'tsep',
            'thod',
        ]);
        expect(result.availableNetworks).not.toContain('ada');
        expect(result.availableNetworks).not.toContain('ltc');
        expect(deps.getAccountInfo.mock.calls.every(([request]) => request.symbol === 'eth')).toBe(
            true,
        );
    });

    it('bounds account discovery and rejects invalid limits before APDUs', async () => {
        const deps = prepareTest([3, 15]);
        deps.getAccountInfo.mockImplementation(({ descriptor }) =>
            Promise.resolve({ success: true, payload: createAccountInfo(descriptor, false) }),
        );

        const result = await discoverLedgerAccounts(deps, {
            networkSymbols: ['eth'].map(asNetworkSymbol),
            maxAccounts: 2,
        });
        expect(result.accounts.map(account => account.index)).toEqual([0, 1]);

        for (const maxAccounts of [0, 1001, 1.5, Number.NaN]) {
            const invalid = prepareTest();
            await expect(
                discoverLedgerAccounts(invalid, {
                    networkSymbols: ['eth'].map(asNetworkSymbol),
                    maxAccounts,
                }),
            ).rejects.toThrow('account limit');
            expect(invalid.accountsDiscoveryService.getInfo).not.toHaveBeenCalled();
        }
    });
});
