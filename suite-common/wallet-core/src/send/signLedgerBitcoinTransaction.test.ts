import { Psbt, Transaction, address } from 'bitcoinjs-lib';

import { type Account, type PrecomposedTransactionFinal } from '@suite-common/wallet-types';

import { signLedgerBitcoinTransaction } from './signLedgerBitcoinTransaction';

const descriptor =
    'zpub6rszzdAK6RuafeRwyN8z1cgWcXCuKbLmjjfnrW4fWKtcoXQ8787214pNJjnBG5UATyghuNzjn6Lfp5k5xymrLFJnCy46bMYJPyZsbpFGagT';
const ownAddress = 'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk';
const recipientAddress = 'bc1q7e6qu5smalrpgqrx9k2gnf0hgjyref5p36ru2m';
const txid = '11'.repeat(32);
const inputPath = [0x80000054, 0x80000000, 0x80000000, 0, 0];
const changePath = [0x80000054, 0x80000000, 0x80000000, 1, 0];

const account = {
    symbol: 'btc',
    networkType: 'bitcoin',
    accountType: 'normal',
    descriptor,
    index: 0,
    path: "m/84'/0'/0'",
    utxo: [{ txid, vout: 0, amount: '100000', address: ownAddress, path: "m/84'/0'/0'/0/0" }],
} as unknown as Account;

const transaction = {
    type: 'final',
    fee: '1000',
    inputs: [
        {
            prev_hash: txid,
            prev_index: 0,
            amount: '100000',
            address_n: inputPath,
            sequence: 0xfffffffd,
        },
    ],
    outputs: [
        { address: recipientAddress, amount: '70000' },
        { address_n: changePath, amount: '29000' },
    ],
} as unknown as PrecomposedTransactionFinal;

const makeSignedTransaction = (psbtBase64: string, changeAmount = 29000): string => {
    const psbt = Psbt.fromBase64(psbtBase64);
    const signed = new Transaction();
    signed.version = psbt.version;
    signed.locktime = psbt.locktime;
    psbt.txInputs.forEach(input => signed.addInput(input.hash, input.index, input.sequence));
    psbt.txOutputs.forEach((output, index) =>
        signed.addOutput(output.script, index === 1 ? changeAmount : output.value),
    );
    signed.setWitness(0, [
        Buffer.from([0x30, 0x01]),
        psbt.data.inputs[0]!.bip32Derivation![0]!.pubkey,
    ]);

    return signed.toHex();
};

const createSigner = () => ({
    getAccount: jest.fn().mockResolvedValue({ descriptor, masterFingerprint: '5c9e228d' }),
    signTransaction: jest.fn((_: number, psbt: string) =>
        Promise.resolve(makeSignedTransaction(psbt)),
    ),
});

describe(signLedgerBitcoinTransaction.name, () => {
    it('builds a native SegWit PSBT and verifies the signed transaction intent', async () => {
        const signer = createSigner();

        const serializedTx = await signLedgerBitcoinTransaction({
            account,
            transaction,
            signer,
        });

        const psbt = Psbt.fromBase64(signer.signTransaction.mock.calls[0]![1]);
        expect(signer.signTransaction).toHaveBeenCalledWith(0, expect.any(String));
        expect(psbt.data.inputs[0]?.witnessUtxo).toEqual({
            script: address.toOutputScript(ownAddress),
            value: 100000,
        });
        expect(psbt.data.inputs[0]?.bip32Derivation?.[0]?.path).toBe("m/84'/0'/0'/0/0");
        expect(psbt.data.outputs[1]?.bip32Derivation?.[0]?.path).toBe("m/84'/0'/0'/1/0");
        expect(psbt.txOutputs.map(output => output.value)).toEqual([70000, 29000]);
        expect(Transaction.fromHex(serializedTx).outs).toHaveLength(2);
    });

    it('refuses a different account on the connected Ledger', async () => {
        const signer = createSigner();
        signer.getAccount.mockResolvedValue({ descriptor: 'other', masterFingerprint: '5c9e228d' });

        await expect(
            signLedgerBitcoinTransaction({ account, transaction, signer }),
        ).rejects.toThrow('does not match');
        expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('refuses an input absent from the discovered account', async () => {
        const signer = createSigner();
        const differentInput = {
            ...transaction,
            inputs: [{ ...transaction.inputs[0], prev_hash: '22'.repeat(32) }],
        } as PrecomposedTransactionFinal;

        await expect(
            signLedgerBitcoinTransaction({ account, transaction: differentInput, signer }),
        ).rejects.toThrow('UTXO');
        expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('refuses changed outputs returned by the signer', async () => {
        const signer = createSigner();
        signer.signTransaction.mockImplementation((_: number, psbt: string) =>
            Promise.resolve(makeSignedTransaction(psbt, 30000)),
        );

        await expect(
            signLedgerBitcoinTransaction({ account, transaction, signer }),
        ).rejects.toThrow('does not match');
    });

    it('refuses changed inputs returned by the signer', async () => {
        const signer = createSigner();
        signer.signTransaction.mockImplementation((_: number, psbt: string) => {
            const changed = Transaction.fromHex(makeSignedTransaction(psbt));
            changed.ins[0]!.index = 1;

            return Promise.resolve(changed.toHex());
        });

        await expect(
            signLedgerBitcoinTransaction({ account, transaction, signer }),
        ).rejects.toThrow('does not match');
    });

    it('refuses non-decimal satoshi amounts', async () => {
        const signer = createSigner();
        const malformedFee = { ...transaction, fee: '1e3' } as PrecomposedTransactionFinal;

        await expect(
            signLedgerBitcoinTransaction({ account, transaction: malformedFee, signer }),
        ).rejects.toThrow('amount');
        expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('refuses a change output outside this account', async () => {
        const signer = createSigner();
        const differentChange = {
            ...transaction,
            outputs: [transaction.outputs[0], { address_n: inputPath, amount: '29000' }],
        } as PrecomposedTransactionFinal;

        await expect(
            signLedgerBitcoinTransaction({ account, transaction: differentChange, signer }),
        ).rejects.toThrow('change');
        expect(signer.signTransaction).not.toHaveBeenCalled();
    });
});
