import { type Dispatch } from '@reduxjs/toolkit';

import { type LedgerBitcoinService } from '@suite-common/ledger';
import { type TrezorDevice } from '@suite-common/suite-types';
import {
    type Account,
    type FormState,
    type PrecomposedTransactionFinal,
    type PrecomposedTransactionFinalCardano,
} from '@suite-common/wallet-types';
import { type BlockbookTransaction } from '@trezor/blockchain-link-types';
import type TrezorConnect from '@trezor/connect';
import {
    type Address,
    type CardanoAddress,
    type Response as ConnectResponse,
    type PROTO,
} from '@trezor/connect';

export type ConfirmWalletDeviceAddressParams = {
    account: Account;
    addressPath: string;
};

export type SignWalletDeviceTransactionParams = {
    formState: FormState;
    precomposedTransaction: PrecomposedTransactionFinal | PrecomposedTransactionFinalCardano;
    selectedAccount: Account;
    paymentRequests?: PROTO.PaymentRequest[];
};

export type WalletDeviceAccountCapabilities = {
    canSignTransaction: boolean;
    canConfirmAddress: boolean;
};

/** @serviceContract */
export type WalletDeviceOperations = {
    getAccountCapabilities?: (account: Account) => WalletDeviceAccountCapabilities;
    confirmAddress: (
        params: ConfirmWalletDeviceAddressParams,
    ) => Promise<Awaited<ConnectResponse<Address | CardanoAddress>>>;
    signTransaction: (
        params: SignWalletDeviceTransactionParams,
    ) => Promise<{ serializedTx: string; signedTx?: BlockbookTransaction }>;
};

export type CancelWalletDeviceActionParams = {
    device?: TrezorDevice;
    reason?: Parameters<typeof TrezorConnect.cancel>[0];
};

export type WalletDeviceServiceDeps = {
    ledgerBitcoinService: Pick<
        LedgerBitcoinService,
        | 'verifyAddress'
        | 'getAccount'
        | 'signTransaction'
        | 'cancelAction'
        | 'disconnect'
        | 'isConnectionOwner'
    >;
    dispatch: Dispatch;
};

export type WalletDeviceService = {
    get: (device: TrezorDevice) => WalletDeviceOperations | undefined;
    cancelAction: (params: CancelWalletDeviceActionParams) => Promise<void>;
    disconnect: (device: TrezorDevice) => Promise<void>;
};

export type WalletDeviceServiceDep = { walletDeviceService: WalletDeviceService };
