import { ApduBuilder, type DeviceManagementKit } from '@ledgerhq/device-management-kit';

export type ReadLedgerDeviceNameDeps = {
    dmk: Pick<DeviceManagementKit, 'sendApdu'>;
};

// Ledger's OS name command is absent from DMK 1.9.0. Keep this protocol detail in
// the adapter; see LedgerHQ/ledger-live libs/device-core/commands/use-cases/getDeviceName.ts.
export const readLedgerDeviceName = async (
    deps: ReadLedgerDeviceNameDeps,
    sessionId: string,
): Promise<string | undefined> => {
    const send = (ins: number) =>
        deps.dmk.sendApdu({
            sessionId,
            apdu: new ApduBuilder({ cla: 0xe0, ins, p1: 0, p2: 0 }).build().getRawApdu(),
            abortTimeout: 10_000,
        });

    // Nano X firmware can return a stale response without this preparatory command.
    await send(0x50).catch(() => undefined);
    const response = await send(0xd2);
    const status = Buffer.from(response.statusCode).toString('hex');

    if (['6d00', '6e00', '6d06', '6d07'].includes(status)) return undefined;
    if (status !== '9000') throw new Error('Could not read Ledger device name');

    return Buffer.from(response.data).toString('utf8') || undefined;
};
