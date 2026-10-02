import { DeviceModelId } from '@ledgerhq/device-management-kit';
import { speculosTransportFactory } from '@ledgerhq/device-transport-kit-speculos';
import { Psbt, Transaction, address, networks } from 'bitcoinjs-lib';

import { deriveAddresses, getXpubOrDescriptorInfo } from '@trezor/utxo-lib';

import { type LedgerDevice, createLedgerBitcoinServiceForTransport } from '../src';

const service = createLedgerBitcoinServiceForTransport(
    speculosTransportFactory(
        process.env.SPECULOS_API_URL ?? 'http://127.0.0.1:5000',
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

        phase = 'on-device address verification';
        const verifiedAddress = await service.verifyAddress(0, 0);
        if (verifiedAddress !== account.address) {
            throw new Error('Speculos verified a different receiving address');
        }
        process.stdout.write('Ledger Bitcoin on-device address verification passed on Speculos\n');

        phase = 'transaction signing';
        const accountNode = getXpubOrDescriptorInfo(account.descriptor).node;
        const receivePublicKey = Buffer.from(accountNode.derive(0).derive(0).publicKey);
        const changePublicKey = Buffer.from(accountNode.derive(1).derive(0).publicKey);
        const recipientAddress = deriveAddresses(account.descriptor, 'receive', 10, 1)[0]?.address;
        const changeAddress = deriveAddresses(account.descriptor, 'change', 0, 1)[0]?.address;
        if (!recipientAddress || !changeAddress) throw new Error('Could not derive test outputs');

        // This disposable fixture is never broadcast and uses Speculos's default test seed.
        const psbt = new Psbt({ network: networks.bitcoin });
        psbt.setVersion(2);
        psbt.addInput({
            hash: '11'.repeat(32),
            index: 0,
            sequence: 0xfffffffd,
            witnessUtxo: {
                script: address.toOutputScript(account.address, networks.bitcoin),
                value: 100000,
            },
            bip32Derivation: [
                {
                    masterFingerprint: Buffer.from(account.masterFingerprint, 'hex'),
                    path: "m/84'/0'/0'/0/0",
                    pubkey: receivePublicKey,
                },
            ],
        });
        psbt.addOutput({
            address: recipientAddress,
            value: 70000,
        });
        psbt.addOutput({
            address: changeAddress,
            value: 29000,
            bip32Derivation: [
                {
                    masterFingerprint: Buffer.from(account.masterFingerprint, 'hex'),
                    path: "m/84'/0'/0'/1/0",
                    pubkey: changePublicKey,
                },
            ],
        });
        const signed = Transaction.fromHex(await service.signTransaction(0, psbt.toBase64()));
        const input = signed.ins[0];
        const expectedInput = psbt.txInputs[0];
        if (
            signed.version !== psbt.version ||
            signed.locktime !== psbt.locktime ||
            signed.ins.length !== 1 ||
            signed.outs.length !== 2 ||
            !input ||
            !expectedInput ||
            !input.hash.equals(expectedInput.hash) ||
            input.index !== 0 ||
            input.sequence !== 0xfffffffd ||
            input.witness.length !== 2 ||
            !input.witness[1]?.equals(receivePublicKey) ||
            signed.outs.some((output, index) => {
                const expected = psbt.txOutputs[index];

                return (
                    !expected ||
                    output.value !== expected.value ||
                    !output.script.equals(expected.script)
                );
            })
        ) {
            throw new Error('Speculos signed a different transaction');
        }
        process.stdout.write(
            'Ledger Bitcoin transaction signing passed on Speculos (no broadcast)\n',
        );
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
