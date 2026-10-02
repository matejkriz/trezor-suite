import { G } from '@mobily/ts-belt';
import { type GetThunkAPI } from '@reduxjs/toolkit';

import { type DeviceRootState, selectDeviceByStaticSessionId } from '@suite-common/device';
import { type WithServices, createThunk } from '@suite-common/redux-utils';
import { type Account } from '@suite-common/wallet-types';
import {
    getConvertedOrDefaultFeeInfo,
    isTestnet,
    tryGetAccountIdentity,
} from '@suite-common/wallet-utils';
import TrezorConnect from '@trezor/connect';
import { asCoinSymbol } from '@trezor/connect-common';
import stellar from '@trezor/network-stellar/runtime';
import { StellarAssetType } from '@trezor/protobuf/src/definitions';

import { type FeesRootState, selectRawNetworkFeeInfo } from '../fees/feesReducer';
import { type WalletDeviceServiceDep } from '../wallet-device/createWalletDeviceService';
import { getWalletDeviceAccountCapabilities } from '../wallet-device/walletDeviceAccountCapabilities';

export interface TokenThunkPayload {
    account: Account;
    contractAddress: string;
    selectedFee: string;
    customFeePerUnit?: string;
}

type StellarTokenThunkConfig = {
    rejectValue: { error: string; message: string };
    state: ActivateStellarTokenThunkState;
    extra: ActivateStellarTokenThunkDeps;
};

type ManageTrustlineDeps = Pick<
    GetThunkAPI<StellarTokenThunkConfig>,
    'getState' | 'rejectWithValue' | 'extra'
>;

const STELLAR_TOKEN_MODULE_PREFIX = '@common/wallet-core/stellar-token';

const manageTrustline = async (
    payload: TokenThunkPayload,
    operation: 'activate' | 'deactivate',
    deps: ManageTrustlineDeps,
) => {
    const { account, contractAddress, selectedFee, customFeePerUnit } = payload;
    if (G.isNullable(account)) {
        return deps.rejectWithValue({
            error: 'sign-transaction-failed',
            message: 'Invalid input data.',
        });
    }

    const device = selectDeviceByStaticSessionId(deps.getState(), account.deviceState);
    const rawFeeInfo = selectRawNetworkFeeInfo(deps.getState(), account.symbol);

    if (!device || !rawFeeInfo) {
        return deps.rejectWithValue({
            error: 'sign-transaction-failed',
            message: 'Invalid input data.',
        });
    }

    if (
        !getWalletDeviceAccountCapabilities(
            deps.extra.services.walletDeviceService.get(device),
            account,
        ).canSignTransaction
    ) {
        return deps.rejectWithValue({
            error: 'sign-transaction-failed',
            message: 'Account transaction signing is not supported by this device.',
        });
    }

    const feeInfo = getConvertedOrDefaultFeeInfo({
        networkType: account.networkType,
        feeInfo: rawFeeInfo,
    });

    let feePerUnit: string;
    if (selectedFee === 'custom' && customFeePerUnit) {
        feePerUnit = customFeePerUnit;
    } else {
        const feeLevel = feeInfo.levels.find(level => level.label === selectedFee);
        if (!feeLevel) {
            return deps.rejectWithValue({
                error: 'sign-transaction-failed',
                message: 'Invalid input data.',
            });
        }
        feePerUnit = feeLevel.feePerUnit;
    }

    const contractAddressParts = contractAddress.split('-');
    // @ts-expect-error: indexing with noUncheckedIndexedAccess
    const [code, issuer]: [string, string] = contractAddressParts;

    const asset = {
        type: code.length <= 4 ? StellarAssetType.ALPHANUM4 : StellarAssetType.ALPHANUM12,
        code,
        issuer,
    };

    const { buildAddTrustlineTransaction, buildRemoveTrustlineTransaction } = await stellar();

    // Build the appropriate trustline transaction
    const misc = account.misc as { stellarSequence: string };
    const transactionBuilder =
        operation === 'activate' ? buildAddTrustlineTransaction : buildRemoveTrustlineTransaction;

    const testnet = isTestnet(account.symbol);
    const transaction = transactionBuilder({
        descriptor: account.descriptor,
        sequence: misc.stellarSequence,
        fee: feePerUnit,
        asset,
        isTestnet: testnet,
    });
    const xdrBase64 = transaction.toXdr();

    const response = await TrezorConnect.stellarSignTransaction({
        device: {
            path: device.path,
            instance: device.instance,
            state: device.state,
            useEmptyPassphrase: device.useEmptyPassphrase,
        },
        path: account.path,
        xdrBase64,
        testnet,
    });

    if (!response.success) {
        return deps.rejectWithValue({
            error: 'sign-transaction-failed',
            message: response.error.message,
        });
    }

    const signature = Buffer.from(response.payload.signature, 'hex').toString('base64');
    transaction.addSignature(account.descriptor, signature);
    const serializedTx = transaction.toEnvelope().toXdr('hex');

    // Submit transaction to the network
    const pushResponse = await TrezorConnect.pushTransaction({
        tx: serializedTx,
        coin: asCoinSymbol(account.symbol),
        identity: tryGetAccountIdentity(account),
    });

    if (!pushResponse.success) {
        return deps.rejectWithValue({
            error: 'sign-transaction-failed',
            message: pushResponse.error.message,
        });
    }
};

export type ActivateStellarTokenThunkState = DeviceRootState & FeesRootState;

export type ActivateStellarTokenThunkDeps = WithServices<WalletDeviceServiceDep>;

export const activateStellarTokenThunk = createThunk<
    void,
    TokenThunkPayload,
    {
        rejectValue: { error: string; message: string };
        state: ActivateStellarTokenThunkState;
        extra: ActivateStellarTokenThunkDeps;
    }
>(`${STELLAR_TOKEN_MODULE_PREFIX}/activateStellarTokenThunk`, (payload, deps) =>
    manageTrustline(payload, 'activate', deps),
);

export type DeactivateStellarTokenThunkState = ActivateStellarTokenThunkState;

export type DeactivateStellarTokenThunkDeps = ActivateStellarTokenThunkDeps;

export const deactivateStellarTokenThunk = createThunk<
    void,
    TokenThunkPayload,
    {
        rejectValue: { error: string; message: string };
        state: DeactivateStellarTokenThunkState;
        extra: DeactivateStellarTokenThunkDeps;
    }
>(`${STELLAR_TOKEN_MODULE_PREFIX}/deactivateStellarTokenThunk`, (payload, deps) =>
    manageTrustline(payload, 'deactivate', deps),
);
