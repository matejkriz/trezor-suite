import * as varuint from 'varuint-bitcoin';
import * as typeforce from 'typeforce';
import { reverseBuffer } from '../bufferutils';
import * as bcrypto from '../crypto';
import { types } from '../types';
import * as NETWORKS from '../networks';
import type { Network } from '../types';
import type { Input, Output, ZcashSpecific } from '../types/transaction';

export function varSliceSize(someScript: Buffer) {
    const { length } = someScript;
    return varuint.encodingLength(length) + length;
}

export function vectorSize(someVector: Buffer[]) {
    return (
        varuint.encodingLength(someVector.length) +
        someVector.reduce((sum, witness) => sum + varSliceSize(witness), 0)
    );
}

export function isCoinbaseHash(buffer: Buffer): boolean {
    typeforce(types.Hash256bit, buffer);
    for (let i = 0; i < 32; ++i) {
        if (buffer[i] !== 0) return false;
    }
    return true;
}

export const EMPTY_SCRIPT = Buffer.allocUnsafe(0);

export type TransactionOptions = {
    nostrict?: boolean;
    network?: Network;
    useStringValues?: boolean;
};

export class TransactionBase {
    version = 1;
    locktime = 0;
    ins: Input[] = [];
    outs: Output[] = [];

    network: Network;
    type: number | undefined; // Dash, Decred, Zcash
    timestamp: number | undefined; // Peercoin
    expiry: number | undefined; // Decred, Zcash. Block height after which this transactions will expire, or 0 to disable expiry

    constructor(options: TransactionOptions) {
        this.network = options.network || NETWORKS.bitcoin;
    }

    isCoinbase(): boolean {
        return this.ins.length === 1 && isCoinbaseHash(this.ins[0].hash);
    }

    hasWitnesses(): boolean {
        return this.ins.some(x => x.witness.length !== 0);
    }

    weight(): number {
        const base = this.byteLength(false);
        const total = this.byteLength(true);
        return base * 3 + total;
    }

    virtualSize(): number {
        return Math.ceil(this.weight() / 4);
    }

    byteLength(_ALLOW_WITNESS = true): number {
        const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

        return (
            (hasWitnesses ? 10 : 8) +
            (this.timestamp ? 4 : 0) +
            varuint.encodingLength(this.ins.length) +
            varuint.encodingLength(this.outs.length) +
            this.ins.reduce((sum, input) => sum + 40 + varSliceSize(input.script), 0) +
            this.outs.reduce((sum, output) => sum + 8 + varSliceSize(output.script), 0) +
            (hasWitnesses ? this.ins.reduce((sum, input) => sum + vectorSize(input.witness), 0) : 0)
        );
    }

    getHash(forWitness?: boolean): Buffer {
        // wtxid for coinbase is always 32 bytes of 0x00
        if (forWitness && this.isCoinbase()) return Buffer.alloc(32, 0);
        return bcrypto.hash256(this.toBuffer(undefined, undefined, forWitness));
    }

    getId(): string {
        // transaction hash's are displayed in reverse order
        return reverseBuffer(this.getHash(false)).toString('hex');
    }

    getExtraData(): Buffer | void {
        // to override
    }

    getSpecificData(): ZcashSpecific | void {
        // to override
    }

    toBuffer(_buffer?: Buffer, _initialOffset?: number, _ALLOW_WITNESS = true): Buffer {
        // to override
        return EMPTY_SCRIPT;
    }

    toHex(): string {
        return this.toBuffer(undefined, undefined).toString('hex');
    }
}
