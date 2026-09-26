export type LedgerDiscoveryKeyRequest = {
    profile: number;
    account: number;
};

export type LedgerDiscoveryPublicKey = LedgerDiscoveryKeyRequest & {
    publicKey: Uint8Array;
    chainCode: Uint8Array;
    parentFingerprint: Uint8Array;
    childIndex: number;
    depth: number;
};

export type LedgerAccountsDiscoveryInfo = {
    protocolVersion: 1;
    appVersion: string;
    maxBatch: number;
    profiles: number[];
};
