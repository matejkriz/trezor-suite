import { DeviceModelId } from '@ledgerhq/device-management-kit';
import { speculosTransportFactory } from '@ledgerhq/device-transport-kit-speculos';
import { strict as assert } from 'node:assert';
import { pbkdf2Sync } from 'node:crypto';

import { bip32, deriveAddresses } from '@trezor/utxo-lib';

import {
    LedgerAccountsDiscoveryError,
    type LedgerAccountsDiscoveryService,
    type LedgerDevice,
    type LedgerDiscoveryKeyRequest,
    createLedgerBitcoinServiceForTransport,
    getLedgerDiscoveryPath,
    ledgerAccountsDiscoveryProfiles,
    serializeLedgerDiscoveryKey,
} from '../src';

const apiUrl = process.env.SPECULOS_API_URL ?? 'http://127.0.0.1:5000';
const parsedUrl = new URL(apiUrl);
if (
    parsedUrl.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)
) {
    throw new Error('Accounts Discovery smoke requires a local Speculos API');
}

const service = createLedgerBitcoinServiceForTransport(
    speculosTransportFactory(apiUrl, true, DeviceModelId.FLEX),
);

const discoverDevice = () =>
    new Promise<LedgerDevice>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Speculos discovery timed out')), 15_000);

        service.startDiscovery(
            device => {
                clearTimeout(timeout);
                resolve(device);
            },
            () => {
                clearTimeout(timeout);
                reject(new Error('Speculos discovery failed'));
            },
        );
    });

type ScreenEvent = { text: string; x: number; y: number; w: number; h: number };

const approveOnEmulator = async () => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const response = await fetch(`${apiUrl}/events`);
        if (!response.ok) throw new Error('Could not read Speculos UI events');
        const body: { events: ScreenEvent[] } = await response.json();
        const button = body.events.find(event => event.text === 'Allow discovery');
        if (button) {
            const approval = await fetch(`${apiUrl}/finger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'press-and-release',
                    x: 240,
                    y: button.y + button.h / 2,
                }),
            });
            if (!approval.ok) throw new Error('Could not approve on Speculos');

            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Speculos consent screen did not appear');
};

const expectApprovalRequired = async (discovery: LedgerAccountsDiscoveryService) => {
    await assert.rejects(
        discovery.readPublicKeys([{ profile: 3, account: 0 }]),
        error => error instanceof LedgerAccountsDiscoveryError && error.code === 'not-approved',
    );
};

const main = async () => {
    let phase = 'discovery';
    let discovery: LedgerAccountsDiscoveryService | undefined;
    try {
        const device = await discoverDevice();
        phase = 'connection';
        await service.connect(device, { owner: 'accounts-discovery-smoke' });
        assert(service.isConnectionOwner('accounts-discovery-smoke'));
        phase = 'detecting custom app';
        assert.equal(await service.hasAccountsDiscovery(), true);
        phase = 'opening custom app';
        discovery = await service.openAccountsDiscovery();
        const info = await discovery.getInfo();
        assert.equal(info.appVersion, '0.1.0');
        assert.equal(info.maxBatch, 3);
        assert.deepEqual(
            info.profiles,
            ledgerAccountsDiscoveryProfiles.map(profile => profile.id),
        );
        await expectApprovalRequired(discovery);

        phase = 'on-device consent';
        const clearEvents = await fetch(`${apiUrl}/events`, { method: 'DELETE' });
        if (!clearEvents.ok) throw new Error('Could not clear Speculos UI events');
        await Promise.all([discovery.open(), approveOnEmulator()]);

        phase = 'batched public account export';
        const requests: LedgerDiscoveryKeyRequest[] = [0, 7].flatMap(account =>
            ledgerAccountsDiscoveryProfiles
                .filter(profile => account === 0 || profile.accountType !== 'root')
                .map(profile => ({ profile: profile.id, account })),
        );
        const keys = await discovery.readPublicKeys(requests);
        assert.equal(keys.length, 49);

        // Fixed public Speculos fixture: never use this mnemonic with real funds.
        const seed = pbkdf2Sync(
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            'mnemonic',
            2048,
            64,
            'sha512',
        );
        const root = bip32.fromSeed(seed);
        const fingerprint = Uint8Array.from(root.fingerprint);
        for (const key of keys) {
            const profile = ledgerAccountsDiscoveryProfiles.find(
                candidate => candidate.id === key.profile,
            );
            assert(profile);
            if (profile.curve === 'secp256k1') {
                const path = getLedgerDiscoveryPath(key);
                assert(path);
                const node = root.derivePath(path);
                assert.deepEqual(Buffer.from(key.publicKey), Buffer.from(node.publicKey));
                assert.deepEqual(Buffer.from(key.chainCode), Buffer.from(node.chainCode));
                assert.deepEqual(
                    Buffer.from(key.parentFingerprint),
                    Buffer.from(root.derivePath(path.slice(0, path.lastIndexOf('/'))).fingerprint),
                );
            }
            const result = serializeLedgerDiscoveryKey(key, fingerprint);
            assert(result.success);
            assert(result.payload.descriptor.length > 0);
        }

        phase = 'Bitcoin and Ethereum key conversion';
        const bitcoinKey = keys.find(key => key.profile === 3 && key.account === 0);
        const ethereumKey = keys.find(key => key.profile === 15 && key.account === 0);
        assert(bitcoinKey && ethereumKey);
        const bitcoin = serializeLedgerDiscoveryKey(bitcoinKey);
        const ethereum = serializeLedgerDiscoveryKey(ethereumKey);
        assert(bitcoin.success && ethereum.success);
        assert.equal(
            bitcoin.payload.legacyXpub,
            root.derivePath("m/84'/0'/0'").neutered().toBase58(),
        );
        assert.equal(
            deriveAddresses(bitcoin.payload.descriptor, 'receive', 0, 1)[0]?.address,
            'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
        );
        assert.equal(ethereum.payload.address, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');

        phase = 'resetting approval';
        await discovery.close();
        await expectApprovalRequired(discovery);
        process.stdout.write(
            'Accounts Discovery DMK Flex smoke passed: 49 records, all profile conversions, BTC/ETH goldens, consent and reset\n',
        );
    } catch (error) {
        const name = error instanceof Error ? error.name : 'UnknownError';
        process.stderr.write(`Accounts Discovery DMK smoke failed during ${phase}: ${name}\n`);
        process.exitCode = 1;
    } finally {
        await discovery?.close().catch(() => undefined);
        await service.dispose();
    }
};

void main().catch(() => {
    process.stderr.write('Accounts Discovery DMK smoke cleanup failed\n');
    process.exitCode = 1;
});
