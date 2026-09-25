import { crypto } from 'bitcoinjs-lib';

export const getLedgerWalletIdentity = (descriptor: string): string =>
    `ledger${crypto.sha256(Buffer.from(descriptor, 'utf8')).toString('hex')}`;
