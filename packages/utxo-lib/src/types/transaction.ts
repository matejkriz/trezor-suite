export interface Output {
    script: Buffer;
    value: number | string;
    decredVersion?: number;
}

export interface Input {
    hash: Buffer;
    index: number;
    script: Buffer;
    sequence: number;
    witness: Buffer[];
    decredTree?: number;
    decredWitness?: {
        value: number | string;
        height: number;
        blockIndex: number;
        script: Buffer;
    };
}

// Zcash

export interface ZcashCompressedG {
    x: Buffer;
    yLsb: number;
}

export interface ZcashSaplingZKProof {
    type: 'sapling';
    sA: Buffer;
    sB: Buffer;
    sC: Buffer;
}

export interface ZcashJoinSplitZKProof {
    type: 'joinsplit';
    gA: ZcashCompressedG;
    gAPrime: ZcashCompressedG;
    gB: ZcashCompressedG;
    gBPrime: ZcashCompressedG;
    gC: ZcashCompressedG;
    gCPrime: ZcashCompressedG;
    gK: ZcashCompressedG;
    gH: ZcashCompressedG;
}

export interface ZcashJoinSplits {
    vpubOld: number;
    vpubNew: number;
    anchor: Buffer;
    nullifiers: Buffer[];
    commitments: Buffer[];
    ephemeralKey: Buffer;
    randomSeed: Buffer;
    macs: Buffer[];
    zkproof: ZcashSaplingZKProof | ZcashJoinSplitZKProof;
    ciphertexts: Buffer[];
}

export interface ZcashVShieldedSpend {
    cv: Buffer;
    anchor: Buffer;
    nullifier: Buffer;
    rk: Buffer;
    zkproof: ZcashSaplingZKProof;
    spendAuthSig: Buffer;
}

export interface ZcashVShieldedOutput {
    cv: Buffer;
    cmu: Buffer;
    ephemeralKey: Buffer;
    encCiphertext: Buffer;
    outCiphertext: Buffer;
    zkproof: ZcashSaplingZKProof;
}

export interface ZcashSpecific {
    // ZCash version >= 2
    joinsplits: ZcashJoinSplits[];
    joinsplitPubkey: Buffer;
    joinsplitSig: Buffer;
    // ZCash version >= 3
    overwintered: number; // 1 if the transaction is post overwinter upgrade, 0 otherwise
    versionGroupId: number; // 0x03C48270 (63210096) for overwinter and 0x892F2085 (2301567109) for sapling
    // ZCash version >= 4
    valueBalance: number;
    vShieldedSpend: ZcashVShieldedSpend[];
    vShieldedOutput: ZcashVShieldedOutput[];
    bindingSig: Buffer;
}
