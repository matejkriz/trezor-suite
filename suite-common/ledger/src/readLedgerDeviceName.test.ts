import { createMockDeps } from '@suite-common/dependency-injection';

import { type ReadLedgerDeviceNameDeps, readLedgerDeviceName } from './readLedgerDeviceName';

describe('readLedgerDeviceName', () => {
    it('reads the user-assigned UTF-8 name through DMK', async () => {
        const deps = createMockDeps<ReadLedgerDeviceNameDeps>({
            dmk: {
                sendApdu: () =>
                    Promise.resolve({
                        data: Buffer.from('Matějův Ledger'),
                        statusCode: Uint8Array.of(0x90, 0x00),
                    }),
            },
        });

        await expect(readLedgerDeviceName(deps, 'session')).resolves.toBe('Matějův Ledger');
        expect(deps.dmk.sendApdu).toHaveBeenLastCalledWith({
            sessionId: 'session',
            apdu: Uint8Array.of(0xe0, 0xd2, 0, 0, 0),
            abortTimeout: 10_000,
        });
    });

    it('still reads the name if the legacy Nano X cleaning instruction is rejected', async () => {
        const deps = createMockDeps<ReadLedgerDeviceNameDeps>({ dmk: { sendApdu: jest.fn() } });
        deps.dmk.sendApdu.mockRejectedValueOnce(new Error('Unsupported cleaning command'));
        deps.dmk.sendApdu.mockResolvedValueOnce({
            data: Buffer.from('My Flex'),
            statusCode: Uint8Array.of(0x90, 0x00),
        });

        await expect(readLedgerDeviceName(deps, 'session')).resolves.toBe('My Flex');
    });

    it.each([0x6d00, 0x6e00, 0x6d06, 0x6d07])(
        'does not substitute a model for an unavailable name (%s)',
        async status => {
            const deps = createMockDeps<ReadLedgerDeviceNameDeps>({
                dmk: {
                    sendApdu: () =>
                        Promise.resolve({
                            data: new Uint8Array(),
                            statusCode: Uint8Array.of(status >> 8, status & 0xff),
                        }),
                },
            });

            await expect(readLedgerDeviceName(deps, 'session')).resolves.toBeUndefined();
        },
    );

    it('does not conceal a locked device as an unsupported name', async () => {
        const deps = createMockDeps<ReadLedgerDeviceNameDeps>({
            dmk: {
                sendApdu: () =>
                    Promise.resolve({
                        data: new Uint8Array(),
                        statusCode: Uint8Array.of(0x55, 0x15),
                    }),
            },
        });

        await expect(readLedgerDeviceName(deps, 'session')).rejects.toThrow(
            'Could not read Ledger device name',
        );
    });
});
