import {
    ApduBuilder,
    type ApduResponse,
    type DeviceManagementKit,
} from '@ledgerhq/device-management-kit';

import {
    type LedgerAccountsDiscoveryInfo,
    type LedgerDiscoveryKeyRequest,
    type LedgerDiscoveryPublicKey,
} from './accountsDiscoveryTypes';

export type LedgerAccountsDiscoveryServiceDeps = {
    dmk: Pick<DeviceManagementKit, 'sendApdu'>;
    getSessionId: () => string | undefined;
};

export type LedgerAccountsDiscoveryService = {
    getInfo: () => Promise<LedgerAccountsDiscoveryInfo>;
    open: () => Promise<void>;
    readPublicKeys: (
        requests: readonly LedgerDiscoveryKeyRequest[],
    ) => Promise<LedgerDiscoveryPublicKey[]>;
    close: () => Promise<void>;
};

export class LedgerAccountsDiscoveryError extends Error {
    constructor(
        readonly code:
            'unsupported-app' | 'rejected' | 'protocol' | 'not-approved' | 'connection' | 'request',
    ) {
        const messages = {
            'unsupported-app': 'Open the Accounts Discovery application on your Ledger',
            rejected: 'Accounts Discovery approval was rejected on the device',
            protocol: 'Invalid Accounts Discovery metadata or response',
            'not-approved': 'Accounts Discovery requires device approval',
            connection: 'Ledger connection changed or is not connected',
            request: 'Invalid Accounts Discovery request',
        };
        super(messages[code]);
        this.name = 'LedgerAccountsDiscoveryError';
    }
}

const parseInfo = (data: Uint8Array): LedgerAccountsDiscoveryInfo => {
    const [magicA, magicD, protocol, major, minor, patch, flags, maxBatch, count] = data;
    const profiles = Array.from(data.slice(9));
    if (
        magicA !== 0x41 ||
        magicD !== 0x44 ||
        protocol !== 1 ||
        flags !== 1 ||
        maxBatch === undefined ||
        maxBatch < 1 ||
        maxBatch > 3 ||
        count === undefined ||
        count < 1 ||
        count > 25 ||
        data.length !== 9 + count ||
        profiles.some(profile => profile < 1 || profile > 25) ||
        new Set(profiles).size !== profiles.length
    )
        throw new LedgerAccountsDiscoveryError('protocol');

    return { protocolVersion: 1, appVersion: `${major}.${minor}.${patch}`, maxBatch, profiles };
};

const parseKeys = (
    data: Uint8Array,
    requests: readonly LedgerDiscoveryKeyRequest[],
): LedgerDiscoveryPublicKey[] => {
    if (data[0] !== requests.length) throw new LedgerAccountsDiscoveryError('protocol');
    let offset = 1;
    const keys = requests.map(request => {
        const profile = data[offset++];
        const keyLength = data[offset++];
        const expectedLength = request.profile >= 22 ? 32 : 33;
        if (
            profile !== request.profile ||
            keyLength !== expectedLength ||
            offset + keyLength + 41 > data.length
        ) {
            throw new LedgerAccountsDiscoveryError('protocol');
        }
        const publicKey = data.slice(offset, offset + keyLength);
        offset += keyLength;
        if (keyLength === 33 && publicKey[0] !== 2 && publicKey[0] !== 3) {
            throw new LedgerAccountsDiscoveryError('protocol');
        }
        const chainCode = data.slice(offset, offset + 32);
        offset += 32;
        const parentFingerprint = data.slice(offset, offset + 4);
        offset += 4;
        const childIndex = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0);
        offset += 4;
        const depth = data[offset++];
        if (depth === undefined || depth < 2 || depth > 5)
            throw new LedgerAccountsDiscoveryError('protocol');

        return { ...request, publicKey, chainCode, parentFingerprint, childIndex, depth };
    });
    if (offset !== data.length) throw new LedgerAccountsDiscoveryError('protocol');

    return keys;
};

export const createLedgerAccountsDiscoveryService = (
    deps: LedgerAccountsDiscoveryServiceDeps,
): LedgerAccountsDiscoveryService => {
    let approvedSession: string | undefined;
    let approvalRevision = 0;
    let cachedInfo: { sessionId: string; info: LedgerAccountsDiscoveryInfo } | undefined;
    let queue = Promise.resolve();

    const requireSameSession = (sessionId: string) => {
        if (deps.getSessionId() !== sessionId) {
            approvedSession = undefined;
            throw new LedgerAccountsDiscoveryError('connection');
        }
    };
    const enqueue = <Output>(
        operation: (sessionId: string) => Promise<Output>,
    ): Promise<Output> => {
        const sessionId = deps.getSessionId();
        if (!sessionId) return Promise.reject(new LedgerAccountsDiscoveryError('connection'));
        const result = queue.then(() => {
            requireSameSession(sessionId);

            return operation(sessionId);
        });
        queue = result.then(
            () => undefined,
            () => undefined,
        );

        return result;
    };
    const send = async (sessionId: string, ins: number, data: Uint8Array = new Uint8Array()) => {
        let response: ApduResponse;
        try {
            response = await deps.dmk.sendApdu({
                sessionId,
                apdu: new ApduBuilder({ cla: 0xe1, ins, p1: 0, p2: 0 })
                    .addBufferToData(data)
                    .build()
                    .getRawApdu(),
                abortTimeout: ins === 2 ? 120_000 : 10_000,
            });
        } catch {
            approvedSession = undefined;
            throw new LedgerAccountsDiscoveryError('connection');
        }
        requireSameSession(sessionId);
        const status = Buffer.from(response.statusCode).toString('hex');
        if (['6d00', '6e00'].includes(status))
            throw new LedgerAccountsDiscoveryError('unsupported-app');
        if (status === '6985') {
            approvedSession = undefined;
            throw new LedgerAccountsDiscoveryError('rejected');
        }
        if (status !== '9000') throw new LedgerAccountsDiscoveryError('protocol');

        return response.data;
    };
    const getInfo = async (sessionId: string) => {
        if (cachedInfo?.sessionId === sessionId) return cachedInfo.info;
        const info = parseInfo(await send(sessionId, 1));
        cachedInfo = { sessionId, info };

        return info;
    };
    const requireCurrentApprovalRevision = (revision: number) => {
        if (revision !== approvalRevision) throw new LedgerAccountsDiscoveryError('not-approved');
    };
    const requireApproval = (sessionId: string, revision: number) => {
        requireCurrentApprovalRevision(revision);
        if (approvedSession !== sessionId) throw new LedgerAccountsDiscoveryError('not-approved');
    };
    const revokeDeviceApproval = async (sessionId: string) => {
        approvedSession = undefined;
        if (deps.getSessionId() !== sessionId) return;
        try {
            await send(sessionId, 4);
        } catch {
            // Cleanup failure must not replace the original protocol error with transport details.
        }
    };

    return {
        getInfo: () =>
            enqueue(async sessionId => {
                const info = await getInfo(sessionId);

                return { ...info, profiles: [...info.profiles] };
            }),
        open: () => {
            approvedSession = undefined;
            const revision = ++approvalRevision;

            return enqueue(async sessionId => {
                requireCurrentApprovalRevision(revision);
                await getInfo(sessionId);
                requireCurrentApprovalRevision(revision);
                const response = await send(sessionId, 2);
                if (response.length !== 0 || revision !== approvalRevision) {
                    await revokeDeviceApproval(sessionId);
                    throw new LedgerAccountsDiscoveryError(
                        response.length !== 0 ? 'protocol' : 'not-approved',
                    );
                }
                approvedSession = sessionId;
            });
        },
        readPublicKeys: originalRequests => {
            const requests = originalRequests.map(request => ({
                profile: request.profile,
                account: request.account,
            }));
            const revision = approvalRevision;

            return enqueue(async sessionId => {
                requireApproval(sessionId, revision);
                const info = await getInfo(sessionId);
                if (
                    requests.length < 1 ||
                    requests.length > 256 ||
                    requests.some(
                        request =>
                            !Number.isInteger(request.account) ||
                            request.account < 0 ||
                            request.account > 999 ||
                            !info.profiles.includes(request.profile) ||
                            (request.profile === 24 && request.account !== 0),
                    )
                )
                    throw new LedgerAccountsDiscoveryError('request');

                const keys: LedgerDiscoveryPublicKey[] = [];
                try {
                    for (let offset = 0; offset < requests.length; offset += info.maxBatch) {
                        requireApproval(sessionId, revision);
                        const batch = requests.slice(offset, offset + info.maxBatch);
                        const data = Buffer.alloc(1 + batch.length * 9);
                        data[0] = batch.length;
                        batch.forEach(({ profile, account }, index) => {
                            data[1 + index * 9] = profile;
                            data.writeUInt32BE(account, 2 + index * 9);
                        });
                        const response = await send(sessionId, 3, data);
                        requireApproval(sessionId, revision);
                        keys.push(...parseKeys(response, batch));
                    }

                    return keys;
                } catch (error) {
                    await revokeDeviceApproval(sessionId);
                    throw error;
                }
            });
        },
        close: () => {
            approvedSession = undefined;
            approvalRevision++;

            return enqueue(async sessionId => {
                if ((await send(sessionId, 4)).length !== 0)
                    throw new LedgerAccountsDiscoveryError('protocol');
            });
        },
    };
};
