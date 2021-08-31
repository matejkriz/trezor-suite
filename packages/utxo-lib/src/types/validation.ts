// upstream file: https://github.com/bitcoinjs/bitcoinjs-lib/blob/7b753caad6a5bf13d40ffb6ae28c2b00f7f5f585/ts_src/types.ts
// fork file: https://github.com/trezor/trezor-utxo-lib/blob/4dfd162ad35362ec513d5a60dddcd702d4aebb84/src/types.js
// Differences:
// - TODO

import * as typeforce from 'typeforce';

// eslint-disable-next-line no-restricted-properties
const UINT31_MAX = Math.pow(2, 31) - 1;
export function UInt31(value: number) {
    return typeforce.UInt32(value) && value <= UINT31_MAX;
}

export function BIP32Path(value: string) {
    return typeforce.String(value) && !!value.match(/^(m\/)?(\d+'?\/)*\d+'?$/);
}

export function Signer(obj: any) {
    return (
        (typeforce.Buffer(obj.publicKey) || typeof obj.getPublicKey === 'function') &&
        typeof obj.sign === 'function'
    );
}

const SATOSHI_MAX = 21 * 1e14;
export function Satoshi(value: number) {
    return typeforce.UInt53(value) && value <= SATOSHI_MAX;
}

// external dependent types
export const BigNumber = typeforce.quacksLike('BigNumber');

// exposed, external API
export const ECSignature = typeforce.compile({ r: BigNumber, s: BigNumber });
export const networkVersion = typeforce.anyOf(typeforce.UInt8, typeforce.UInt16);
export const Network = typeforce.compile({
    messagePrefix: typeforce.anyOf(typeforce.Buffer, typeforce.String),
    bip32: {
        public: typeforce.UInt32,
        private: typeforce.UInt32,
    },
    pubKeyHash: networkVersion,
    scriptHash: networkVersion,
    wif: typeforce.anyOf(typeforce.UInt8, typeforce.UInt16),
});

export const Buffer256bit = typeforce.BufferN(32);
export const Hash160bit = typeforce.BufferN(20);
export const Hash256bit = typeforce.BufferN(32);
export const {
    Number,
    Array,
    Boolean,
    String,
    Buffer,
    Hex,
    maybe,
    tuple,
    UInt8,
    UInt16,
    UInt32,
    Function,
    BufferN,
    Nil,
    anyOf,
} = typeforce;
