import { bip32, deriveAddresses } from '@trezor/utxo-lib';

import {
    getLedgerDiscoveryPath,
    ledgerAccountsDiscoveryProfiles,
    ledgerAccountsDiscoveryUnsupportedNetworks,
    serializeLedgerDiscoveryKey,
} from './accountsDiscoveryProfiles';
import type { LedgerDiscoveryPublicKey } from './accountsDiscoveryTypes';

const generatorPublicKey = Buffer.from(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    'hex',
);
const ed25519PublicKey = Buffer.from(
    'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    'hex',
);
const bitcoinNativeSegwitXpub =
    'xpub6DDUPHpUo4pcy43iJeZjbSVWGav1SMMmuWdMHiGtkK8rhKmfbomtkwW6GKs1GGAKehT6QRocrmda3WWxXawpjmwaUHfFRXuKrXSapdckEYF';
const bitcoinTaprootXpub =
    'xpub6Bw885JisRbcKmowfBvMmCxaFHodKn1VpmRmctmJJoM8D4DzyP4qJv8ZdD9V9r3SSGjmK2KJEDnvLH6f1Q4HrobEvnCeKydNvf1eir3RHZk';

const createPublicKey = (profile: number): LedgerDiscoveryPublicKey => {
    const path = getLedgerDiscoveryPath({ profile, account: 0 });
    if (!path) throw new Error('Test profile is missing');

    const pathParts = path.slice(2).split('/');
    const child = pathParts.at(-1)!;

    return {
        profile,
        account: 0,
        depth: pathParts.length,
        childIndex: Number.parseInt(child, 10) + (child.endsWith("'") ? 0x80000000 : 0),
        parentFingerprint: new Uint8Array(4),
        chainCode: new Uint8Array(32).fill(1),
        publicKey: profile >= 22 ? ed25519PublicKey : generatorPublicKey,
    };
};

const createBitcoinPublicKey = (profile: number, xpub: string): LedgerDiscoveryPublicKey => {
    const node = bip32.fromBase58(xpub);
    const parentFingerprint = Buffer.alloc(4);
    parentFingerprint.writeUInt32BE(node.parentFingerprint);

    return {
        ...createPublicKey(profile),
        publicKey: node.publicKey,
        chainCode: node.chainCode,
        parentFingerprint,
        childIndex: node.index,
        depth: node.depth,
    };
};

describe('Accounts Discovery profiles', () => {
    it('covers only Suite networks and explicitly omits Cardano', () => {
        const symbols = [
            ...new Set(ledgerAccountsDiscoveryProfiles.flatMap(p => p.networkSymbols)),
        ];

        expect(symbols.toSorted()).toEqual(
            [
                'btc',
                'test',
                'regtest',
                'ltc',
                'doge',
                'bch',
                'zec',
                'eth',
                'pol',
                'bsc',
                'arb',
                'base',
                'op',
                'rhc',
                'hype',
                'avax',
                'etc',
                'tsep',
                'thod',
                'xrp',
                'txrp',
                'trx',
                'ttrx',
                'sol',
                'dsol',
                'xlm',
                'txlm',
            ].toSorted(),
        );
        expect(serializeLedgerDiscoveryKey(createPublicKey(15))).toMatchObject({ success: true });
        expect(Object.keys(ledgerAccountsDiscoveryUnsupportedNetworks)).toEqual(['ada']);
        expect(serializeLedgerDiscoveryKey({ ...createPublicKey(15), profile: 26 })).toMatchObject({
            success: false,
            error: { type: 'unsupported-profile' },
        });
    });

    it.each([
        [3, 7, "m/84'/0'/7'"],
        [15, 7, "m/44'/60'/0'/0/7"],
        [16, 7, "m/44'/60'/7'/0/0"],
        [17, 7, "m/44'/60'/0'/7"],
        [18, 7, "m/44'/61'/0'/0/7"],
        [19, 7, "m/44'/144'/7'/0/0"],
        [20, 7, "m/44'/195'/0'/0/7"],
        [21, 7, "m/44'/195'/7'/0/0"],
        [22, 7, "m/44'/501'/7'/0'"],
        [23, 7, "m/44'/501'/7'"],
        [24, 0, "m/44'/501'"],
        [25, 7, "m/44'/148'/7'"],
    ])('uses profile %s account %s at %s', (profile, account, path) => {
        expect(getLedgerDiscoveryPath({ profile, account })).toBe(path);
    });

    it('rejects invalid and nonexistent root account indices', () => {
        expect(getLedgerDiscoveryPath({ profile: 3, account: -1 })).toBeUndefined();
        expect(getLedgerDiscoveryPath({ profile: 3, account: 1.5 })).toBeUndefined();
        expect(getLedgerDiscoveryPath({ profile: 3, account: 1000 })).toBeUndefined();
        expect(getLedgerDiscoveryPath({ profile: 3, account: 0x80000000 })).toBeUndefined();
        expect(getLedgerDiscoveryPath({ profile: 24, account: 1 })).toBeUndefined();
    });

    it('serializes a real Bitcoin native SegWit account including parent metadata', () => {
        const result = serializeLedgerDiscoveryKey(
            createBitcoinPublicKey(3, bitcoinNativeSegwitXpub),
        );

        expect(result).toMatchObject({
            success: true,
            payload: {
                path: "m/84'/0'/0'",
                accountType: 'normal',
                legacyXpub: bitcoinNativeSegwitXpub,
                descriptor:
                    'zpub6rszzdAK6RuafeRwyN8z1cgWcXCuKbLmjjfnrW4fWKtcoXQ8787214pNJjnBG5UATyghuNzjn6Lfp5k5xymrLFJnCy46bMYJPyZsbpFGagT',
            },
        });
        if (!result.success) throw new Error('Bitcoin serialization failed');

        expect(deriveAddresses(result.payload.descriptor, 'receive', 0, 1)[0]?.address).toBe(
            'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk',
        );
    });

    it('serializes Taproot with the actual master fingerprint and checksum', () => {
        const result = serializeLedgerDiscoveryKey(
            createBitcoinPublicKey(4, bitcoinTaprootXpub),
            Buffer.from('5c9e228d', 'hex'),
        );

        expect(result).toMatchObject({
            success: true,
            payload: {
                accountType: 'taproot',
                descriptor: `tr([5c9e228d/86'/0'/0']${bitcoinTaprootXpub}/<0;1>/*)#4swej4wz`,
            },
        });
        if (!result.success) throw new Error('Taproot serialization failed');

        expect(deriveAddresses(result.payload.descriptor, 'receive', 0, 1)[0]?.address).toBe(
            'bc1ptxs597p3fnpd8gwut5p467ulsydae3rp9z75hd99w8k3ljr9g9rqx6ynaw',
        );
    });

    it('requires an actual master fingerprint for Taproot', () => {
        expect(serializeLedgerDiscoveryKey(createPublicKey(4))).toMatchObject({ success: false });
    });

    it.each([
        [1, 'xpub', 'legacy'],
        [2, 'ypub', 'segwit'],
        [5, 'tpub', 'legacy'],
        [6, 'upub', 'segwit'],
        [7, 'vpub', 'normal'],
        [9, 'Ltub', 'legacy'],
        [10, 'Mtub', 'segwit'],
        [11, 'zpub', 'normal'],
        [12, 'dgub', 'normal'],
        [13, 'xpub', 'normal'],
        [14, 'xpub', 'normal'],
    ])('uses Suite extended public key encoding for profile %s', (profile, prefix, accountType) => {
        const result = serializeLedgerDiscoveryKey(createPublicKey(profile));

        expect(result).toMatchObject({ success: true, payload: { accountType } });
        if (!result.success) throw new Error('Extended public key serialization failed');

        expect(result.payload.descriptor.startsWith(prefix)).toBe(true);
    });

    it.each([
        [15, '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf'],
        [19, 'rBgGZ9tc4him9KBzD8fKFiQz3fSZpaSwMH'],
        [20, 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
        [22, 'FVen3X669xLzsi6N2V91DoiyzHzg1uAgqiT8jZ9nS96Z'],
        [25, 'GDLVVGABQKYQVN6VJP7NHSLEA45A5YLS6PNKMIZFV4BBU2HXA5IRVHUR'],
    ])('encodes the expected address for profile %s', (profile, address) => {
        expect(serializeLedgerDiscoveryKey(createPublicKey(profile))).toMatchObject({
            success: true,
            payload: { descriptor: address, address },
        });
    });

    it.each([
        { depth: 4 },
        { childIndex: 0 },
        { chainCode: new Uint8Array(31) },
        { parentFingerprint: new Uint8Array(3) },
        { publicKey: new Uint8Array(33) },
    ])('rejects malformed Bitcoin metadata %s', changedKey => {
        expect(serializeLedgerDiscoveryKey({ ...createPublicKey(3), ...changedKey })).toMatchObject(
            {
                success: false,
                error: { type: 'invalid-key' },
            },
        );
    });

    it('rejects small order and malformed Ed25519 points', () => {
        expect(
            serializeLedgerDiscoveryKey({ ...createPublicKey(22), publicKey: new Uint8Array(32) }),
        ).toMatchObject({ success: false, error: { type: 'invalid-key' } });
        expect(
            serializeLedgerDiscoveryKey({
                ...createPublicKey(22),
                publicKey: new Uint8Array(32).fill(0xff),
            }),
        ).toMatchObject({ success: false, error: { type: 'invalid-key' } });
    });

    it('preserves distinct Suite and Ledger Live account derivation profiles', () => {
        expect(serializeLedgerDiscoveryKey(createPublicKey(15))).toMatchObject({
            payload: {
                accountType: 'normal',
                networkSymbols: expect.arrayContaining(['eth', 'base']),
            },
        });
        expect(serializeLedgerDiscoveryKey(createPublicKey(16))).toMatchObject({
            payload: {
                accountType: 'ledger',
                networkSymbols: expect.arrayContaining(['eth', 'base']),
            },
        });
        expect(serializeLedgerDiscoveryKey(createPublicKey(18))).toMatchObject({
            payload: { networkSymbols: ['etc'] },
        });
    });
});
