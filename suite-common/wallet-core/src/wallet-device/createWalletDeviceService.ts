import { type Dispatch } from '@reduxjs/toolkit';

import { isLedgerDevice } from '@suite-common/device';
import { type LedgerBitcoinService } from '@suite-common/ledger';
import { type TrezorDevice } from '@suite-common/suite-types';
import {
    type Account,
    type FormState,
    type PrecomposedTransactionFinal,
    type PrecomposedTransactionFinalCardano,
} from '@suite-common/wallet-types';
import { type BlockbookTransaction } from '@trezor/blockchain-link-types';
import TrezorConnect, {
    type Address,
    type CardanoAddress,
    type Response as ConnectResponse,
    type PROTO,
} from '@trezor/connect';

import { createLedgerWalletDeviceOperations } from './createLedgerWalletDeviceOperations';

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

export const createWalletDeviceService = (deps: WalletDeviceServiceDeps): WalletDeviceService => ({
    get: device =>
        isLedgerDevice(device) ? createLedgerWalletDeviceOperations(deps, device) : undefined,
    async cancelAction({ device, reason }) {
        if (isLedgerDevice(device)) {
            const owner = device.state?.sessionId;
            if (!device.connected || !owner || !deps.ledgerBitcoinService.isConnectionOwner(owner))
                return;

            const cancellationReason = typeof reason === 'string' ? reason : reason?.reason;
            deps.ledgerBitcoinService.cancelAction(
                cancellationReason === 'tx-timeout' ? 'timeout' : 'cancelled',
            );
        } else {
            await TrezorConnect.cancel(reason);
        }
    },
    async disconnect(device) {
        if (isLedgerDevice(device)) {
            const owner = device.state?.sessionId;
            if (!device.connected || !owner || !deps.ledgerBitcoinService.isConnectionOwner(owner))
                return;

            await deps.ledgerBitcoinService.disconnect({ owner });
        }
    },
});

export const injectWalletDeviceService = (
    services: WalletDeviceServiceDep,
): WalletDeviceServiceDep => ({
    walletDeviceService: services.walletDeviceService,
});
