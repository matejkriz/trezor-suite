import * as validation from './validation';

export const types = validation;

export interface Bip32 {
    public: number;
    private: number;
}

export interface Network {
    messagePrefix: string;
    bech32: string;
    bip32: Bip32;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
    consensusBranchId?: { [version: number]: number };
    forkId?: number;
    coin: string;
}

export type StackElement = Buffer | number;
export type Stack = StackElement[];
export type StackFunction = () => Stack;

export interface Payment {
    name?: string;
    network?: Network;
    output?: Buffer;
    data?: Buffer[];
    m?: number;
    n?: number;
    pubkeys?: Buffer[];
    input?: Buffer;
    signatures?: Buffer[];
    pubkey?: Buffer;
    signature?: Buffer;
    address?: string;
    hash?: Buffer;
    redeem?: Payment;
    witness?: Buffer[];
}
export declare type PaymentCreator = (a: Payment, opts?: PaymentOpts) => Payment;
export declare type PaymentFunction = () => Payment;
export interface PaymentOpts {
    validate?: boolean;
    allowIncomplete?: boolean;
}
