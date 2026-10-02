import { type TrezorDevice } from '@suite-common/suite-types';
import { type NetworkSymbol } from '@suite-common/wallet-config';
import {
    type Account,
    type FormState,
    type PrecomposedTransactionFinal,
    type PrecomposedTransactionFinalCardano,
} from '@suite-common/wallet-types';
import { type BlockbookTransaction } from '@trezor/blockchain-link-types';
import type TrezorConnect from '@trezor/connect';
import {
    type AccountInfo,
    type Address,
    type CardanoAddress,
    type Response as ConnectResponse,
    type PROTO,
} from '@trezor/connect';
import { type Without } from '@trezor/type-utils';

import { type CreateAccountActionProps } from '../accounts/accountsActions';

export type WalletDeviceDiscoveredAccount = Without<CreateAccountActionProps, 'deviceState'>;

export type WalletDeviceDiscoveryResult = {
    accounts: WalletDeviceDiscoveredAccount[];
    failedNetworks: NetworkSymbol[];
};

export type DiscoverWalletDeviceAccountsParams = {
    networkSymbols: NetworkSymbol[];
    signal: AbortSignal;
    getAccountInfo: (params: {
        symbol: NetworkSymbol;
        descriptor: string;
    }) => Promise<Awaited<ConnectResponse<AccountInfo>>>;
};

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
    transactionReviewSteps?: number;
    cancelAction?: (reason: CancelWalletDeviceActionParams['reason']) => Promise<void>;
    disconnect?: () => Promise<void>;
    discoverAccounts: (
        params: DiscoverWalletDeviceAccountsParams,
    ) => Promise<WalletDeviceDiscoveryResult>;
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

/** @serviceContract */
export type WalletDeviceOperationsFactory = (
    device: TrezorDevice,
) => WalletDeviceOperations | undefined;

export type WalletDeviceServiceDeps = {
    getOperations: WalletDeviceOperationsFactory;
    cancelTrezorAction: (
        reason: CancelWalletDeviceActionParams['reason'],
    ) => ReturnType<typeof TrezorConnect.cancel>;
};

export type WalletDeviceService = {
    get: (device: TrezorDevice) => WalletDeviceOperations | undefined;
    cancelAction: (params: CancelWalletDeviceActionParams) => Promise<void>;
    disconnect: (device: TrezorDevice) => Promise<void>;
};

export type WalletDeviceServiceDep = { walletDeviceService: WalletDeviceService };
