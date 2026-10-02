import { ApduResponse } from '@ledgerhq/device-management-kit';

import { createMockDeps } from '@suite-common/dependency-injection';

import { type LedgerDiscoveryKeyRequest } from './accountsDiscoveryTypes';
import {
    type LedgerAccountsDiscoveryServiceDeps,
    createLedgerAccountsDiscoveryService,
} from './createLedgerAccountsDiscoveryService';

const info = Uint8Array.from([0x41, 0x44, 1, 0, 1, 0, 1, 3, 3, 3, 15, 22]);
const success = (data: Uint8Array = new Uint8Array()) =>
    new ApduResponse({
        data,
        statusCode: Uint8Array.from([0x90, 0]),
    });

const keyResponse = (requests: LedgerDiscoveryKeyRequest[]) => {
    const records = requests.map(({ profile, account }) => {
        const publicKey =
            profile >= 22 ? Buffer.alloc(32, 1) : Buffer.from(`02${'11'.repeat(32)}`, 'hex');
        const record = Buffer.alloc(2 + publicKey.length + 32 + 4 + 4 + 1);
        record[0] = profile;
        record[1] = publicKey.length;
        publicKey.copy(record, 2);
        record.fill(2, 2 + publicKey.length, 2 + publicKey.length + 32);
        record.writeUInt32BE(0x80000000 + account, record.length - 5);
        record[record.length - 1] = 3;

        return record;
    });

    return success(Buffer.concat([Buffer.from([requests.length]), ...records]));
};

const setup = () => {
    const deps = createMockDeps<LedgerAccountsDiscoveryServiceDeps>({
        dmk: { sendApdu: () => Promise.resolve(success()) },
        getSessionId: () => 'session-a',
    });
    deps.dmk.sendApdu.mockResolvedValue(success());
    const service = createLedgerAccountsDiscoveryService(deps);

    return { deps, service };
};

describe('Accounts Discovery protocol', () => {
    it('reads and validates the application metadata without requesting public keys', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));

        expect(await service.getInfo()).toEqual({
            protocolVersion: 1,
            appVersion: '0.1.0',
            maxBatch: 3,
            profiles: [3, 15, 22],
        });
        expect(deps.dmk.sendApdu).toHaveBeenCalledWith({
            sessionId: 'session-a',
            apdu: Uint8Array.from([0xe1, 1, 0, 0, 0]),
            abortTimeout: 10000,
        });
    });

    it('requires device consent and returns BTC and ETH from one batch', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        const requests = [
            { profile: 3, account: 0 },
            { profile: 15, account: 0 },
        ];
        deps.dmk.sendApdu.mockResolvedValueOnce(keyResponse(requests));

        const keys = await service.readPublicKeys(requests);

        expect(keys.map(({ profile, account }) => ({ profile, account }))).toEqual(requests);
        expect(keys[0]?.publicKey).toHaveLength(33);
        expect(keys[0]?.chainCode).toHaveLength(32);
        expect(deps.dmk.sendApdu.mock.calls.map(([arg]) => Array.from(arg.apdu))).toEqual([
            [0xe1, 1, 0, 0, 0],
            [0xe1, 2, 0, 0, 0],
            [0xe1, 3, 0, 0, 19, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0],
        ]);
    });

    it('refuses public key requests without approval', async () => {
        const { deps, service } = setup();

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
        expect(deps.dmk.sendApdu).not.toHaveBeenCalled();
    });

    it('retains no approval after reset', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        await service.close();

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
    });

    it('does not reuse an approval with another session', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        deps.getSessionId.mockReturnValue('session-b');

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
    });

    it('rejects user denial without exposing keys or silently approving', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info)).mockResolvedValueOnce(
            new ApduResponse({
                data: new Uint8Array(),
                statusCode: Uint8Array.from([0x69, 0x85]),
            }),
        );

        await expect(service.open()).rejects.toThrow('rejected');
        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
    });

    it.each([
        new Uint8Array(),
        Uint8Array.from([0x41, 0x44, 2, 0, 1, 0, 1, 3, 1, 3]),
        Uint8Array.from([0x41, 0x44, 1, 0, 1, 0, 0, 3, 1, 3]),
        Uint8Array.from([0x41, 0x44, 1, 0, 1, 0, 1, 4, 1, 3]),
        Uint8Array.from([0x41, 0x44, 1, 0, 1, 0, 1, 3, 2, 3, 3]),
        Uint8Array.from([0x41, 0x44, 1, 0, 1, 0, 1, 3, 1, 26]),
    ])('rejects malformed or unsupported metadata %j', async data => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(data));

        await expect(service.getInfo()).rejects.toThrow('metadata');
    });

    it('splits more keys into bounded batches without requesting approval again', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        const requests = Array.from({ length: 7 }, (_, account) => ({ profile: 3, account }));
        deps.dmk.sendApdu
            .mockResolvedValueOnce(keyResponse(requests.slice(0, 3)))
            .mockResolvedValueOnce(keyResponse(requests.slice(3, 6)))
            .mockResolvedValueOnce(keyResponse(requests.slice(6)));

        expect(await service.readPublicKeys(requests)).toHaveLength(7);
        expect(deps.dmk.sendApdu.mock.calls.filter(([arg]) => arg.apdu[1] === 2)).toHaveLength(1);
    });

    it('rejects a mismatched response profile', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        deps.dmk.sendApdu.mockResolvedValueOnce(keyResponse([{ profile: 15, account: 0 }]));

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'response',
        );
    });

    it.each([-1, 1000, 1.5, NaN])(
        'rejects an invalid account %j before sending data',
        async account => {
            const { deps, service } = setup();
            deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
            await service.open();
            deps.dmk.sendApdu.mockClear();

            await expect(service.readPublicKeys([{ profile: 3, account }])).rejects.toThrow(
                'request',
            );
            expect(deps.dmk.sendApdu).not.toHaveBeenCalled();
        },
    );

    it('revokes device approval when OPEN_SESSION succeeds with an invalid payload', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu
            .mockResolvedValueOnce(success(info))
            .mockResolvedValueOnce(success(Uint8Array.from([1])));

        await expect(service.open()).rejects.toThrow('response');
        expect(deps.dmk.sendApdu.mock.calls.map(([request]) => request.apdu[1])).toEqual([1, 2, 4]);
        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
    });

    it('preserves a protocol error when best-effort approval revocation also fails', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu
            .mockResolvedValueOnce(success(info))
            .mockResolvedValueOnce(success(Uint8Array.from([1])))
            .mockRejectedValueOnce(new Error('Confidential device identity'));

        await expect(service.open()).rejects.toThrow(
            'Invalid Accounts Discovery metadata or response',
        );
        expect(deps.dmk.sendApdu.mock.calls.at(-1)?.[0].apdu[1]).toBe(4);
    });

    it('snapshots request objects before queueing so caller mutation cannot change exported keys', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        const requests = [{ profile: 3, account: 0 }];
        deps.dmk.sendApdu.mockResolvedValueOnce(keyResponse([{ profile: 3, account: 0 }]));

        const pending = service.readPublicKeys(requests);
        requests[0]!.profile = 15;
        requests[0]!.account = 999;
        requests.push({ profile: 22, account: 7 });

        expect((await pending).map(({ profile, account }) => ({ profile, account }))).toEqual([
            { profile: 3, account: 0 },
        ]);
        expect(deps.dmk.sendApdu.mock.calls.at(-1)?.[0].apdu).toEqual(
            Uint8Array.from([0xe1, 3, 0, 0, 10, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0]),
        );
    });

    it('keeps cached protocol metadata private when a consumer mutates its result', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        const metadata = await service.getInfo();
        metadata.maxBatch = 255;
        metadata.profiles.push(26);

        expect(await service.getInfo()).toMatchObject({ maxBatch: 3, profiles: [3, 15, 22] });
        await service.open();
        await expect(service.readPublicKeys([{ profile: 26, account: 0 }])).rejects.toThrow(
            'request',
        );
        expect(
            deps.dmk.sendApdu.mock.calls.filter(([request]) => request.apdu[1] === 3),
        ).toHaveLength(0);
    });

    it('does not let a queued open restore permission after close was requested', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.getInfo();
        deps.dmk.sendApdu.mockImplementation(({ apdu }) =>
            Promise.resolve(apdu[1] === 3 ? keyResponse([{ profile: 3, account: 0 }]) : success()),
        );

        const opening = service.open();
        const reading = service.readPublicKeys([{ profile: 3, account: 0 }]);
        const closing = service.close();
        const results = await Promise.allSettled([opening, reading, closing]);

        expect(results.map(result => result.status)).toEqual(['rejected', 'rejected', 'fulfilled']);
        expect(
            deps.dmk.sendApdu.mock.calls.filter(([request]) => request.apdu[1] === 3),
        ).toHaveLength(0);
    });

    it('revokes a device approval that completes after close was requested', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.getInfo();
        let finishApproval: (response: ApduResponse) => void = () => {
            throw new Error('Approval fixture was not initialized');
        };
        const approval = new Promise<ApduResponse>(resolve => {
            finishApproval = resolve;
        });
        let markStarted: () => void = () => {
            throw new Error('Approval fixture was not initialized');
        };
        const started = new Promise<void>(resolve => {
            markStarted = resolve;
        });
        deps.dmk.sendApdu.mockImplementationOnce(() => {
            markStarted();

            return approval;
        });

        const opening = service.open();
        await started;
        const closing = service.close();
        const finished = Promise.allSettled([opening, closing]);
        finishApproval(success());
        expect((await finished).map(result => result.status)).toEqual(['rejected', 'fulfilled']);
        expect(
            deps.dmk.sendApdu.mock.calls.filter(([request]) => request.apdu[1] === 4).length,
        ).toBeGreaterThanOrEqual(1);
        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
    });

    it('does not return public keys from an in-flight batch after close is requested', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        let closing: Promise<void> | undefined;
        deps.dmk.sendApdu.mockImplementationOnce(() => {
            closing = service.close();

            return Promise.resolve(keyResponse([{ profile: 3, account: 0 }]));
        });

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'approval',
        );
        await closing;
        expect(deps.dmk.sendApdu.mock.calls.at(-1)?.[0].apdu[1]).toBe(4);
    });

    it('does not reset a replacement session after a malformed opening response', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info)).mockImplementationOnce(() => {
            deps.getSessionId.mockReturnValue('session-b');

            return Promise.resolve(success(Uint8Array.from([1])));
        });

        await expect(service.open()).rejects.toThrow('changed');
        expect(deps.dmk.sendApdu.mock.calls.map(([request]) => request.apdu[1])).toEqual([1, 2]);
    });

    it('does not expose raw transport error messages', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockRejectedValueOnce(
            new Error('Private session and account request data'),
        );

        await expect(service.getInfo()).rejects.toThrow(
            'Ledger connection changed or is not connected',
        );
    });

    it('does not accept keys returned after the connection changed', async () => {
        const { deps, service } = setup();
        deps.dmk.sendApdu.mockResolvedValueOnce(success(info));
        await service.open();
        deps.dmk.sendApdu.mockImplementationOnce(() => {
            deps.getSessionId.mockReturnValue('session-b');

            return Promise.resolve(keyResponse([{ profile: 3, account: 0 }]));
        });

        await expect(service.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'changed',
        );
    });
});
