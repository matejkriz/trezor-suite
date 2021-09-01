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
