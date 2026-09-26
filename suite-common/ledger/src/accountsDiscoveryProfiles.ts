import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { base32nopad, base58 } from '@scure/base';

import { addDescriptorChecksum, crypto } from '@trezor/utxo-lib';

import type { LedgerDiscoveryKeyRequest, LedgerDiscoveryPublicKey } from './accountsDiscoveryTypes';

export type LedgerDiscoveryNetworkSymbol =
    | 'btc'
    | 'test'
    | 'regtest'
    | 'ltc'
    | 'doge'
    | 'bch'
    | 'zec'
    | 'eth'
    | 'pol'
    | 'bsc'
    | 'arb'
    | 'base'
    | 'op'
    | 'rhc'
    | 'hype'
    | 'avax'
    | 'etc'
    | 'tsep'
    | 'thod'
    | 'xrp'
    | 'txrp'
    | 'trx'
    | 'ttrx'
    | 'sol'
    | 'dsol'
    | 'xlm'
    | 'txlm';

export type LedgerDiscoveryAccountType =
    'normal' | 'legacy' | 'segwit' | 'taproot' | 'ledger' | 'root';

type KeyEncoding = 'xpub' | 'taproot' | 'ethereum' | 'ripple' | 'tron' | 'solana' | 'stellar';

export type LedgerAccountsDiscoveryProfile = {
    id: number;
    pathTemplate: string;
    curve: 'secp256k1' | 'ed25519';
    encoding: KeyEncoding;
    accountType: LedgerDiscoveryAccountType;
    networkSymbols: readonly LedgerDiscoveryNetworkSymbol[];
    xpubVersion?: number;
    legacyXpubVersion?: number;
};

const ethereumNetworks = ['eth', 'pol', 'bsc', 'arb', 'base', 'op', 'rhc', 'hype', 'avax'] as const;
const ethereumTestNetworks = ['tsep', 'thod'] as const;

export const ledgerAccountsDiscoveryUnsupportedNetworks = {
    ada: 'Cardano requires Ledger BIP32-Ed25519 extended key derivation; this app supports SLIP-10 Ed25519 only.',
} as const;

export const ledgerAccountsDiscoveryProfiles: readonly LedgerAccountsDiscoveryProfile[] = [
    {
        id: 1,
        pathTemplate: "m/44'/0'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'legacy',
        networkSymbols: ['btc'],
        xpubVersion: 0x0488b21e,
    },
    {
        id: 2,
        pathTemplate: "m/49'/0'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'segwit',
        networkSymbols: ['btc'],
        xpubVersion: 0x049d7cb2,
        legacyXpubVersion: 0x0488b21e,
    },
    {
        id: 3,
        pathTemplate: "m/84'/0'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['btc'],
        xpubVersion: 0x04b24746,
        legacyXpubVersion: 0x0488b21e,
    },
    {
        id: 4,
        pathTemplate: "m/86'/0'/i'",
        curve: 'secp256k1',
        encoding: 'taproot',
        accountType: 'taproot',
        networkSymbols: ['btc'],
        xpubVersion: 0x0488b21e,
    },
    {
        id: 5,
        pathTemplate: "m/44'/1'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'legacy',
        networkSymbols: ['test', 'regtest'],
        xpubVersion: 0x043587cf,
    },
    {
        id: 6,
        pathTemplate: "m/49'/1'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'segwit',
        networkSymbols: ['test', 'regtest'],
        xpubVersion: 0x044a5262,
        legacyXpubVersion: 0x043587cf,
    },
    {
        id: 7,
        pathTemplate: "m/84'/1'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['test', 'regtest'],
        xpubVersion: 0x045f1cf6,
        legacyXpubVersion: 0x043587cf,
    },
    {
        id: 8,
        pathTemplate: "m/86'/1'/i'",
        curve: 'secp256k1',
        encoding: 'taproot',
        accountType: 'taproot',
        networkSymbols: ['test', 'regtest'],
        xpubVersion: 0x043587cf,
    },
    {
        id: 9,
        pathTemplate: "m/44'/2'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'legacy',
        networkSymbols: ['ltc'],
        xpubVersion: 0x019da462,
    },
    {
        id: 10,
        pathTemplate: "m/49'/2'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'segwit',
        networkSymbols: ['ltc'],
        xpubVersion: 0x01b26ef6,
        legacyXpubVersion: 0x019da462,
    },
    {
        id: 11,
        pathTemplate: "m/84'/2'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['ltc'],
        xpubVersion: 0x04b24746,
        legacyXpubVersion: 0x019da462,
    },
    {
        id: 12,
        pathTemplate: "m/44'/3'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['doge'],
        xpubVersion: 0x02facafd,
    },
    {
        id: 13,
        pathTemplate: "m/44'/145'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['bch'],
        xpubVersion: 0x0488b21e,
    },
    {
        id: 14,
        pathTemplate: "m/44'/133'/i'",
        curve: 'secp256k1',
        encoding: 'xpub',
        accountType: 'normal',
        networkSymbols: ['zec'],
        xpubVersion: 0x0488b21e,
    },
    {
        id: 15,
        pathTemplate: "m/44'/60'/0'/0/i",
        curve: 'secp256k1',
        encoding: 'ethereum',
        accountType: 'normal',
        networkSymbols: [...ethereumNetworks, ...ethereumTestNetworks],
    },
    {
        id: 16,
        pathTemplate: "m/44'/60'/i'/0/0",
        curve: 'secp256k1',
        encoding: 'ethereum',
        accountType: 'ledger',
        networkSymbols: ethereumNetworks,
    },
    {
        id: 17,
        pathTemplate: "m/44'/60'/0'/i",
        curve: 'secp256k1',
        encoding: 'ethereum',
        accountType: 'legacy',
        networkSymbols: ['eth'],
    },
    {
        id: 18,
        pathTemplate: "m/44'/61'/0'/0/i",
        curve: 'secp256k1',
        encoding: 'ethereum',
        accountType: 'normal',
        networkSymbols: ['etc'],
    },
    {
        id: 19,
        pathTemplate: "m/44'/144'/i'/0/0",
        curve: 'secp256k1',
        encoding: 'ripple',
        accountType: 'normal',
        networkSymbols: ['xrp', 'txrp'],
    },
    {
        id: 20,
        pathTemplate: "m/44'/195'/0'/0/i",
        curve: 'secp256k1',
        encoding: 'tron',
        accountType: 'normal',
        networkSymbols: ['trx', 'ttrx'],
    },
    {
        id: 21,
        pathTemplate: "m/44'/195'/i'/0/0",
        curve: 'secp256k1',
        encoding: 'tron',
        accountType: 'ledger',
        networkSymbols: ['trx'],
    },
    {
        id: 22,
        pathTemplate: "m/44'/501'/i'/0'",
        curve: 'ed25519',
        encoding: 'solana',
        accountType: 'normal',
        networkSymbols: ['sol', 'dsol'],
    },
    {
        id: 23,
        pathTemplate: "m/44'/501'/i'",
        curve: 'ed25519',
        encoding: 'solana',
        accountType: 'ledger',
        networkSymbols: ['sol'],
    },
    {
        id: 24,
        pathTemplate: "m/44'/501'",
        curve: 'ed25519',
        encoding: 'solana',
        accountType: 'root',
        networkSymbols: ['sol', 'dsol'],
    },
    {
        id: 25,
        pathTemplate: "m/44'/148'/i'",
        curve: 'ed25519',
        encoding: 'stellar',
        accountType: 'normal',
        networkSymbols: ['xlm', 'txlm'],
    },
];

export type LedgerDiscoveryAccount = {
    profile: number;
    index: number;
    path: string;
    descriptor: string;
    address?: string;
    legacyXpub?: string;
    accountType: LedgerDiscoveryAccountType;
    networkSymbols: readonly LedgerDiscoveryNetworkSymbol[];
};

type LedgerDiscoveryKeyError = {
    type: 'unsupported-profile' | 'invalid-key' | 'missing-master-fingerprint';
    message: string;
};

export type LedgerDiscoveryKeyResult =
    | { success: true; payload: LedgerDiscoveryAccount }
    | { success: false; error: LedgerDiscoveryKeyError };

export const getLedgerDiscoveryProfile = (
    profile: number,
): LedgerAccountsDiscoveryProfile | undefined =>
    ledgerAccountsDiscoveryProfiles.find(candidate => candidate.id === profile);

export const getLedgerDiscoveryPath = (request: LedgerDiscoveryKeyRequest): string | undefined => {
    const profile = getLedgerDiscoveryProfile(request.profile);

    if (
        !profile ||
        !Number.isSafeInteger(request.account) ||
        request.account < 0 ||
        request.account > 999
    ) {
        return undefined;
    }
    if (profile.accountType === 'root' && request.account !== 0) return undefined;

    return profile.pathTemplate.replace('i', String(request.account));
};

const encodeBase58Check = (payload: Uint8Array): string =>
    base58.encode(
        Uint8Array.from(
            Buffer.concat([payload, crypto.hash256(Buffer.from(payload)).subarray(0, 4)]),
        ),
    );

const getEthereumAddress = (publicKey: Uint8Array): string => {
    const uncompressed = secp256k1.Point.fromBytes(publicKey).toBytes(false);
    const lowerCaseAddress = Buffer.from(keccak_256(uncompressed.slice(1)).slice(-20)).toString(
        'hex',
    );
    const checksum = Buffer.from(
        keccak_256(Uint8Array.from(Buffer.from(lowerCaseAddress))),
    ).toString('hex');

    return `0x${Array.from(lowerCaseAddress, (character, index) =>
        Number.parseInt(checksum.charAt(index), 16) >= 8 ? character.toUpperCase() : character,
    ).join('')}`;
};

const getRippleAddress = (publicKey: Uint8Array): string => {
    const payload = Buffer.concat([Buffer.from([0]), crypto.hash160(Buffer.from(publicKey))]);
    const bitcoinAlphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const rippleAlphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

    return Array.from(encodeBase58Check(payload), character =>
        rippleAlphabet.charAt(bitcoinAlphabet.indexOf(character)),
    ).join('');
};

const getTronAddress = (publicKey: Uint8Array): string => {
    const uncompressed = secp256k1.Point.fromBytes(publicKey).toBytes(false);
    const addressBytes = keccak_256(uncompressed.slice(1)).slice(-20);

    return encodeBase58Check(Buffer.concat([Buffer.from([0x41]), addressBytes]));
};

const getStellarAddress = (publicKey: Uint8Array): string => {
    const payload = Buffer.concat([Buffer.from([6 << 3]), publicKey]);
    let checksum = 0;

    for (const byte of payload) {
        checksum ^= byte << 8;
        for (let bit = 0; bit < 8; bit++) {
            checksum = ((checksum << 1) ^ (checksum & 0x8000 ? 0x1021 : 0)) & 0xffff;
        }
    }

    return base32nopad.encode(
        Uint8Array.from(Buffer.concat([payload, Buffer.from([checksum & 0xff, checksum >>> 8])])),
    );
};

const getAddress = (
    encoding: Exclude<KeyEncoding, 'xpub' | 'taproot'>,
    publicKey: Uint8Array,
): string => {
    switch (encoding) {
        case 'ethereum':
            return getEthereumAddress(publicKey);
        case 'ripple':
            return getRippleAddress(publicKey);
        case 'tron':
            return getTronAddress(publicKey);
        case 'solana':
            return base58.encode(publicKey);
        case 'stellar':
            return getStellarAddress(publicKey);
    }
};

const serializeExtendedPublicKey = (key: LedgerDiscoveryPublicKey, version: number): string => {
    const payload = Buffer.alloc(78);
    payload.writeUInt32BE(version, 0);
    payload.writeUInt8(key.depth, 4);
    payload.set(key.parentFingerprint, 5);
    payload.writeUInt32BE(key.childIndex, 9);
    payload.set(key.chainCode, 13);
    payload.set(key.publicKey, 45);

    return encodeBase58Check(payload);
};

export const serializeLedgerDiscoveryKey = (
    key: LedgerDiscoveryPublicKey,
    rootFingerprint?: Uint8Array,
): LedgerDiscoveryKeyResult => {
    const profile = getLedgerDiscoveryProfile(key.profile);
    if (!profile) {
        return {
            success: false,
            error: {
                type: 'unsupported-profile',
                message: 'Unsupported Accounts Discovery profile',
            },
        };
    }

    const path = getLedgerDiscoveryPath(key);
    const pathParts = path?.slice(2).split('/');
    const lastPathPart = pathParts?.at(-1);
    const expectedChildIndex =
        lastPathPart === undefined
            ? undefined
            : Number.parseInt(lastPathPart, 10) + (lastPathPart.endsWith("'") ? 0x80000000 : 0);

    if (
        !path ||
        key.depth !== pathParts?.length ||
        key.childIndex !== expectedChildIndex ||
        key.chainCode.length !== 32 ||
        key.parentFingerprint.length !== 4
    ) {
        return {
            success: false,
            error: { type: 'invalid-key', message: 'Invalid Accounts Discovery key metadata' },
        };
    }

    try {
        const publicKey = Uint8Array.from(key.publicKey);
        if (profile.curve === 'secp256k1') {
            if (publicKey.length !== 33 || ![2, 3].includes(publicKey[0] ?? 0)) {
                return {
                    success: false,
                    error: {
                        type: 'invalid-key',
                        message: 'Invalid compressed secp256k1 public key',
                    },
                };
            }
            secp256k1.Point.fromBytes(publicKey).assertValidity();
        } else {
            if (publicKey.length !== 32) {
                return {
                    success: false,
                    error: { type: 'invalid-key', message: 'Invalid Ed25519 public key length' },
                };
            }
            const point = ed25519.Point.fromBytes(publicKey, false);
            point.assertValidity();
            if (!point.isTorsionFree() || point.isSmallOrder()) {
                return {
                    success: false,
                    error: { type: 'invalid-key', message: 'Invalid Ed25519 public key point' },
                };
            }
        }

        const account: LedgerDiscoveryAccount = {
            profile: key.profile,
            index: key.account,
            path,
            descriptor: '',
            accountType: profile.accountType,
            networkSymbols: profile.networkSymbols,
        };

        if (profile.encoding === 'xpub' || profile.encoding === 'taproot') {
            const version = profile.xpubVersion;
            if (version === undefined) {
                return {
                    success: false,
                    error: {
                        type: 'unsupported-profile',
                        message: 'Missing Accounts Discovery extended public key version',
                    },
                };
            }
            const xpub = serializeExtendedPublicKey(key, version);
            account.legacyXpub = serializeExtendedPublicKey(
                key,
                profile.legacyXpubVersion ?? version,
            );

            if (profile.encoding === 'taproot') {
                if (rootFingerprint?.length !== 4) {
                    return {
                        success: false,
                        error: {
                            type: 'missing-master-fingerprint',
                            message:
                                'Taproot discovery requires the actual wallet master fingerprint',
                        },
                    };
                }
                const fingerprint = Buffer.from(rootFingerprint).toString('hex');
                account.descriptor = addDescriptorChecksum(
                    `tr([${fingerprint}/${path.slice(2)}]${xpub}/<0;1>/*)`,
                );
            } else {
                account.descriptor = xpub;
            }

            return { success: true, payload: account };
        }

        account.address = getAddress(profile.encoding, publicKey);
        account.descriptor = account.address;

        return { success: true, payload: account };
    } catch {
        return {
            success: false,
            error: { type: 'invalid-key', message: 'Invalid Accounts Discovery public key' },
        };
    }
};
