import { Psbt, Transaction, address, networks } from 'bitcoinjs-lib';

import { type Account, type PrecomposedTransactionFinal } from '@suite-common/wallet-types';
import { getSerializedPath } from '@trezor/connect-common';
import { deriveAddresses, getXpubOrDescriptorInfo } from '@trezor/utxo-lib';

export type LedgerBitcoinSigner = {
    getAccount: (index: number) => Promise<{ descriptor: string; masterFingerprint: string }>;
    signTransaction: (index: number, psbt: string) => Promise<string>;
};

type SignLedgerBitcoinTransactionParams = {
    account: Account;
    transaction: PrecomposedTransactionFinal;
    signer: LedgerBitcoinSigner;
    locktime?: number;
};

const getSatoshis = (value: number | string): number => {
    if (typeof value === 'string' && !/^(0|[1-9][0-9]*)$/.test(value)) {
        throw new Error('Invalid Bitcoin amount');
    }

    const amount = typeof value === 'number' ? value : Number(value);

    if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error('Invalid Bitcoin amount');
    }

    return amount;
};

const getAccountAddress = (descriptor: string, branch: number, index: number): string => {
    const derived = deriveAddresses(descriptor, branch === 0 ? 'receive' : 'change', index, 1);
    const derivedAddress = derived[0]?.address;

    if (!derivedAddress) throw new Error('Unable to derive Bitcoin account address');

    return derivedAddress;
};

const getLedgerAddressPath = (path: number[] | undefined, accountIndex: number) => {
    if (
        path?.length !== 5 ||
        path[0] !== 0x80000054 ||
        path[1] !== 0x80000000 ||
        path[2] !== 0x80000000 + accountIndex ||
        ![0, 1].includes(path[3] ?? -1) ||
        !Number.isSafeInteger(path[4]) ||
        (path[4] ?? -1) < 0 ||
        (path[4] ?? 0) >= 0x80000000
    ) {
        throw new Error('Bitcoin path is outside the selected Ledger account');
    }

    return {
        branch: path[3] as 0 | 1,
        index: path[4] as number,
        serialized: getSerializedPath(path),
    };
};

const verifySignedTransaction = (psbt: Psbt, serializedTx: string): string => {
    const signed = Transaction.fromHex(serializedTx);

    if (
        signed.version !== psbt.version ||
        signed.locktime !== psbt.locktime ||
        signed.ins.length !== psbt.txInputs.length ||
        signed.outs.length !== psbt.txOutputs.length
    ) {
        throw new Error('Ledger signed transaction does not match the composed transaction');
    }

    signed.ins.forEach((input, index) => {
        const expected = psbt.txInputs[index];
        const expectedPublicKey = psbt.data.inputs[index]?.bip32Derivation?.[0]?.pubkey;

        if (
            !expected ||
            !input.hash.equals(expected.hash) ||
            input.index !== expected.index ||
            input.sequence !== expected.sequence ||
            input.script.length !== 0 ||
            input.witness.length !== 2 ||
            !expectedPublicKey ||
            !input.witness[1]?.equals(expectedPublicKey)
        ) {
            throw new Error('Ledger signed transaction does not match the composed transaction');
        }
    });

    signed.outs.forEach((output, index) => {
        const expected = psbt.txOutputs[index];

        if (output.value !== expected?.value || !output.script.equals(expected?.script)) {
            throw new Error('Ledger signed transaction does not match the composed transaction');
        }
    });

    return serializedTx;
};

export const signLedgerBitcoinTransaction = async ({
    account,
    transaction,
    signer,
    locktime,
}: SignLedgerBitcoinTransactionParams): Promise<string> => {
    if (
        account.symbol !== 'btc' ||
        account.accountType !== 'normal' ||
        transaction.type !== 'final' ||
        !account.utxo?.length ||
        !transaction.inputs.length ||
        !transaction.outputs.length ||
        !Number.isSafeInteger(account.index) ||
        account.index < 0 ||
        account.path !== `m/84'/0'/${account.index}'`
    ) {
        throw new Error('Only native SegWit Bitcoin Ledger accounts can sign');
    }

    const ledgerAccount = await signer.getAccount(account.index);
    if (ledgerAccount.descriptor !== account.descriptor) {
        throw new Error('Connected Ledger account does not match the selected account');
    }

    if (!/^[0-9a-f]{8}$/i.test(ledgerAccount.masterFingerprint)) {
        throw new Error('Invalid Ledger master fingerprint');
    }

    const accountNode = getXpubOrDescriptorInfo(account.descriptor);
    if (accountNode.paymentType !== 'p2wpkh') {
        throw new Error('Only native SegWit Bitcoin Ledger accounts can sign');
    }

    const psbt = new Psbt({ network: networks.bitcoin });
    psbt.setVersion(2);
    if (locktime !== undefined) psbt.setLocktime(locktime);

    let inputTotal = 0;
    const knownInputs = new Set<string>();

    transaction.inputs.forEach(input => {
        if (!('address_n' in input) || input.script_type === 'EXTERNAL') {
            throw new Error('External Bitcoin inputs are unsupported for Ledger');
        }

        const path = getLedgerAddressPath(input.address_n, account.index);
        const outpoint = `${input.prev_hash}:${input.prev_index}`;
        const utxo = account.utxo?.find(
            candidate => candidate.txid === input.prev_hash && candidate.vout === input.prev_index,
        );

        if (!utxo || knownInputs.has(outpoint)) {
            throw new Error('Bitcoin input UTXO is missing or duplicated');
        }

        knownInputs.add(outpoint);

        const ownAddress = getAccountAddress(account.descriptor, path.branch, path.index);
        const amount = getSatoshis(input.amount);
        if (
            utxo.path !== path.serialized ||
            utxo.address !== ownAddress ||
            getSatoshis(utxo.amount) !== amount
        ) {
            throw new Error('Bitcoin input UTXO does not match the selected Ledger account');
        }

        const { publicKey } = accountNode.node.derive(path.branch).derive(path.index);
        const script = address.toOutputScript(ownAddress, networks.bitcoin);

        psbt.addInput({
            hash: input.prev_hash,
            index: input.prev_index,
            sequence: input.sequence ?? 0xffffffff,
            witnessUtxo: { script, value: amount },
            bip32Derivation: [
                {
                    masterFingerprint: Buffer.from(ledgerAccount.masterFingerprint, 'hex'),
                    path: path.serialized,
                    pubkey: Buffer.from(publicKey),
                },
            ],
        });
        inputTotal += amount;
    });

    let outputTotal = 0;

    transaction.outputs.forEach(output => {
        const amount = getSatoshis(output.amount);

        if ('address_n' in output && output.address_n) {
            const path = getLedgerAddressPath(output.address_n, account.index);
            if (path.branch !== 1) throw new Error('Invalid Bitcoin change path');

            const outputAddress = getAccountAddress(account.descriptor, path.branch, path.index);
            const { publicKey } = accountNode.node.derive(path.branch).derive(path.index);

            psbt.addOutput({
                script: address.toOutputScript(outputAddress, networks.bitcoin),
                value: amount,
                bip32Derivation: [
                    {
                        masterFingerprint: Buffer.from(ledgerAccount.masterFingerprint, 'hex'),
                        path: path.serialized,
                        pubkey: Buffer.from(publicKey),
                    },
                ],
            });
        } else if ('address' in output && output.address) {
            psbt.addOutput({
                script: address.toOutputScript(output.address, networks.bitcoin),
                value: amount,
            });
        } else {
            throw new Error('Unsupported Bitcoin output for Ledger');
        }

        outputTotal += amount;
    });

    if (
        !Number.isSafeInteger(inputTotal) ||
        !Number.isSafeInteger(outputTotal) ||
        inputTotal - outputTotal !== getSatoshis(transaction.fee)
    ) {
        throw new Error('Bitcoin transaction fee does not match the composed transaction');
    }

    const signed = await signer.signTransaction(account.index, psbt.toBase64());

    return verifySignedTransaction(psbt, signed);
};
