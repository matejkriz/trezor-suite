import * as blakeHash from 'blake-hash';
import * as createHash from 'create-hash';
import * as crypto from 'crypto';

export function ripemd160(buffer: Buffer): Buffer {
    let hash: createHash.algorithm = 'rmd160';
    const supportedHashes = crypto.getHashes();
    // some environments (electron) only support the long alias
    if (supportedHashes.indexOf(hash) === -1 && supportedHashes.indexOf('ripemd160') !== -1) {
        hash = 'ripemd160';
    }

    return createHash(hash).update(buffer).digest();
}

export function sha1(buffer: Buffer): Buffer {
    return createHash('sha1').update(buffer).digest();
}

export function sha256(buffer: Buffer): Buffer {
    return createHash('sha256').update(buffer).digest();
}

export function blake256(buffer: Buffer): Buffer {
    return blakeHash('blake256').update(buffer).digest();
}

export function hash160(buffer: Buffer): Buffer {
    return ripemd160(sha256(buffer));
}

export function hash160blake256(buffer: Buffer): Buffer {
    return ripemd160(blake256(buffer));
}

export function hash256(buffer: Buffer): Buffer {
    return sha256(sha256(buffer));
}
