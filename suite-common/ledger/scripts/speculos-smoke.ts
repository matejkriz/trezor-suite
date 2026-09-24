import { DeviceModelId } from '@ledgerhq/device-management-kit';
import { speculosTransportFactory } from '@ledgerhq/device-transport-kit-speculos';

import { type LedgerDevice, createLedgerBitcoinServiceForTransport } from '../src';

const service = createLedgerBitcoinServiceForTransport(
    speculosTransportFactory(
        process.env.SPECULOS_URL ?? 'http://127.0.0.1:5000',
        true,
        DeviceModelId.NANO_SP,
    ),
);

const discoverDevice = () =>
    new Promise<LedgerDevice>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Speculos discovery timed out')), 15_000);

        service.startDiscovery(
            device => {
                clearTimeout(timeout);
                resolve(device);
            },
            error => {
                clearTimeout(timeout);
                reject(error);
            },
        );
    });

const main = async () => {
    let phase = 'discovery';
    try {
        const device = await discoverDevice();
        phase = 'connection';
        await service.connect(device);

        phase = 'account derivation';
        const account = await service.getAccount(0);
        if (
            account.path !== "84'/0'/0'" ||
            !account.extendedPublicKey.startsWith('xpub') ||
            !account.address.startsWith('bc1q')
        ) {
            throw new Error('Speculos returned unexpected Bitcoin account data');
        }

        process.stdout.write('Ledger Bitcoin BIP84 derivation passed on Speculos\n');
    } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        process.stderr.write(
            `Ledger Bitcoin Speculos smoke test failed during ${phase}: ${errorName}\n`,
        );
        process.exitCode = 1;
    } finally {
        await service.dispose();
    }
};

void main().catch(() => {
    process.stderr.write('Ledger Bitcoin Speculos cleanup failed\n');
    process.exitCode = 1;
});
