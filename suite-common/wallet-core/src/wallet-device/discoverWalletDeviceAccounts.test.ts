import { createMockDeps } from '@suite-common/dependency-injection';
import {
    LedgerAccountsDiscoveryError,
    type LedgerAccountsDiscoveryService,
    type LedgerDiscoveryKeyRequest,
    getLedgerDiscoveryPath,
    getLedgerWalletIdentity,
    serializeLedgerDiscoveryKey,
} from '@suite-common/ledger';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import TrezorConnect from '@trezor/connect';
import { bip32 } from '@trezor/utxo-lib';

import {
    type LedgerWalletDeviceOperationsDeps,
    createLedgerWalletDeviceOperationsFactory,
} from './createLedgerWalletDeviceOperations';
import { createWalletDeviceService } from './createWalletDeviceService';
import { WalletDeviceActionError } from './walletDeviceError';
import { createLedgerSuiteDevice } from '../ledger/createLedgerSuiteDevice';

const createKey = (request: LedgerDiscoveryKeyRequest) => {
    const path = getLedgerDiscoveryPath(request);
    if (!path) throw new Error('Invalid fixture path');
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
const bitcoin = serializeLedgerDiscoveryKey(createKey({ profile: 3, account: 0 }));
if (!bitcoin.success) throw new Error('Invalid Bitcoin fixture');
const { descriptor: bitcoinDescriptor } = bitcoin.payload;
const id = getLedgerWalletIdentity(bitcoinDescriptor);
const owner = 'connection-owner';

const prepareTest = (hasAccountsDiscovery = true) => {
    const device = createLedgerSuiteDevice({
        id,
        label: 'Test wallet',
        staticSessionId: `${id}@ledger:0`,
        sessionId: owner,
        supportedNetworks: ['btc', 'eth'].map(asNetworkSymbol),
        accountsDiscoveryAppVersion: hasAccountsDiscovery ? '0.1.0' : undefined,
    });
    const client = createMockDeps<LedgerAccountsDiscoveryService>({
        getInfo: () =>
            Promise.resolve({
                protocolVersion: 1,
                appVersion: '0.1.0',
                maxBatch: 3,
                profiles: [3, 15],
            }),
        open: () => Promise.resolve(),
        close: () => Promise.resolve(),
        readPublicKeys: requests => Promise.resolve(requests.map(createKey)),
    });
    const deps = createMockDeps<LedgerWalletDeviceOperationsDeps>({
        ledgerBitcoinService: {
            isConnectionOwner: candidate => candidate === owner,
            getDeviceInfo: () => ({ name: 'Test wallet', model: 'Ledger Flex' }),
            openAccountsDiscovery: () => Promise.resolve(client),
            getAccount: () =>
                Promise.resolve({
                    descriptor: bitcoinDescriptor,
                    path: "84'/0'/0'",
                    address: 'test-address',
                    masterFingerprint: '1234abcd',
                    extendedPublicKey: 'test-xpub',
                }),
            verifyAddress: null,
            signTransaction: null,
            cancelAction: null,
            disconnect: null,
        },
        dispatch: action => action,
    });
    const params = {
        networkSymbols: ['btc', 'eth'].map(asNetworkSymbol),
        signal: new AbortController().signal,
        getAccountInfo: jest.fn(({ descriptor }: { descriptor: string }) =>
            Promise.resolve({
                success: true as const,
                payload: {
                    descriptor,
                    empty: true,
                    balance: '0',
                    availableBalance: '0',
                    history: { total: 0, unconfirmed: 0 },
                },
            }),
        ),
    };
    const service = createWalletDeviceService({
        getOperations: createLedgerWalletDeviceOperationsFactory(deps),
        cancelTrezorAction: reason => TrezorConnect.cancel(reason),
    });
    const operations = service.get(device);
    if (!operations) throw new Error('Missing fixture operations');

    return { device, deps, client, params, operations, service };
};

describe('Ledger account discovery through the wallet device service', () => {
    it('reuses the connected custom app for enabled Ethereum without invoking the Bitcoin signer', async () => {
        const { deps, client, params, operations } = prepareTest();
        params.networkSymbols = [asNetworkSymbol('eth')];
        const result = await operations.discoverAccounts(params);

        expect(result.accounts.map(account => account.symbol)).toEqual(['eth']);
        expect(result.failedNetworks).toEqual([]);
        expect(deps.ledgerBitcoinService.getAccount).not.toHaveBeenCalled();
        expect(deps.ledgerBitcoinService.openAccountsDiscovery).toHaveBeenCalledTimes(1);
        expect(client.open).toHaveBeenCalledTimes(1);
        expect(client.close).toHaveBeenCalledTimes(1);
        expect(params.getAccountInfo).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'eth' }),
        );
        expect(params.getAccountInfo).not.toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'btc' }),
        );
    });

    it('uses the stock Bitcoin signer when the custom app was not detected', async () => {
        const { deps, params, operations } = prepareTest(false);
        params.networkSymbols = [asNetworkSymbol('btc')];
        const result = await operations.discoverAccounts(params);
        expect(result.accounts.map(account => account.symbol)).toEqual(['btc']);
        expect(deps.ledgerBitcoinService.getAccount).toHaveBeenCalledTimes(1);
        expect(deps.ledgerBitcoinService.openAccountsDiscovery).not.toHaveBeenCalled();
    });

    it('translates rejected custom app consent into the shared cancellation error', async () => {
        const { client, params, operations } = prepareTest();
        client.open.mockRejectedValue(new LedgerAccountsDiscoveryError('rejected'));
        await expect(operations.discoverAccounts(params)).rejects.toEqual(
            new WalletDeviceActionError('rejected'),
        );
        expect(params.getAccountInfo).not.toHaveBeenCalled();
    });

    it('does not open an app for a replaced connection', async () => {
        const { deps, params, operations } = prepareTest();
        deps.ledgerBitcoinService.isConnectionOwner.mockReturnValue(false);
        await expect(operations.discoverAccounts(params)).rejects.toThrow();
        expect(deps.ledgerBitcoinService.openAccountsDiscovery).not.toHaveBeenCalled();
        expect(params.getAccountInfo).not.toHaveBeenCalled();
    });

    it('rejects keys from a different wallet instead of binding them to the current device', async () => {
        const { device, service, params } = prepareTest();
        const operations = service.get({ ...device, id: 'anotherwallet' });
        if (!operations) throw new Error('Missing fixture operations');
        await expect(operations.discoverAccounts(params)).rejects.toThrow(
            'Device returned a different wallet',
        );
    });
});
