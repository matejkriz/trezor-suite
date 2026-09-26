import { deviceActions } from '@suite-common/device';
import { LedgerActionError, getLedgerBitcoinAccountPath } from '@suite-common/ledger';
import { type ButtonRequest, type TrezorDevice } from '@suite-common/suite-types';
import { datetimeToLocktime, isCardanoTx } from '@suite-common/wallet-utils';
import { validatePath } from '@trezor/connect-common';
import { createPendingTransaction } from '@trezor/connect-core/src/bitcoin';
import { BigNumber } from '@trezor/utils';
import { Transaction } from '@trezor/utxo-lib';

import {
    type WalletDeviceOperations,
    type WalletDeviceServiceDeps,
} from './createWalletDeviceService';
import { WalletDeviceActionError } from './walletDeviceError';
import { signLedgerBitcoinTransaction } from '../send/signLedgerBitcoinTransaction';

type LedgerWalletDeviceOperationsDeps = WalletDeviceServiceDeps;

const addressError = {
    success: false as const,
    error: { message: 'Device address verification failed.', code: 'Failure_UnknownCode' as const },
};

export const createLedgerWalletDeviceOperations = (
    deps: LedgerWalletDeviceOperationsDeps,
    device: TrezorDevice,
): WalletDeviceOperations => {
    const owner = device.state?.sessionId;
    const ownsConnection = () =>
        device.connected && !!owner && deps.ledgerBitcoinService.isConnectionOwner(owner);
    const ensureCurrentConnection = () => {
        if (!ownsConnection()) throw new LedgerActionError('cancelled');
    };
    const withCurrentConnection = async <Result>(
        action: () => Promise<Result>,
    ): Promise<Result> => {
        ensureCurrentConnection();
        const result = await action();
        ensureCurrentConnection();

        return result;
    };
    const withButtonRequest = async <Result>(
        buttonRequest: ButtonRequest,
        action: () => Promise<Result>,
    ): Promise<Result> => {
        ensureCurrentConnection();
        deps.dispatch(deviceActions.addButtonRequest({ device, buttonRequest }));

        try {
            return await withCurrentConnection(action);
        } finally {
            if (ownsConnection()) {
                deps.dispatch(
                    deviceActions.removeButtonRequests({
                        device,
                        buttonRequestCode: buttonRequest.code,
                    }),
                );
            }
        }
    };

    return {
        async confirmAddress({ account, addressPath }) {
            if (
                !device.connected ||
                account.deviceState !== device.state?.staticSessionId ||
                account.symbol !== 'btc' ||
                account.networkType !== 'bitcoin' ||
                account.accountType !== 'normal' ||
                !Number.isSafeInteger(account.index) ||
                account.index < 0 ||
                account.index >= 0x80000000 ||
                account.path !== `m/${getLedgerBitcoinAccountPath(account.index)}`
            ) {
                return addressError;
            }

            try {
                const path = validatePath(addressPath, 5);
                const accountPath = validatePath(account.path, 3);
                const addressIndex = path[4];
                if (
                    path.length !== 5 ||
                    path[0] !== accountPath[0] ||
                    path[1] !== accountPath[1] ||
                    path[2] !== accountPath[2] ||
                    path[3] !== 0 ||
                    addressIndex === undefined ||
                    !Number.isSafeInteger(addressIndex) ||
                    addressIndex < 0 ||
                    addressIndex >= 0x80000000
                ) {
                    return addressError;
                }

                const knownAddress = [
                    ...(account.addresses?.used ?? []),
                    ...(account.addresses?.unused ?? []),
                ].find(item => item.path === addressPath)?.address;
                if (!knownAddress) return addressError;

                return await withButtonRequest({ code: 'ButtonRequest_Address' }, async () => {
                    const verifiedAddress = await withCurrentConnection(() =>
                        deps.ledgerBitcoinService.verifyAddress(account.index, addressIndex),
                    );
                    if (verifiedAddress !== knownAddress) return addressError;

                    return {
                        success: true as const,
                        payload: { address: verifiedAddress, path, serializedPath: addressPath },
                    };
                });
            } catch (error) {
                if (error instanceof LedgerActionError) {
                    return {
                        success: false,
                        error: {
                            code:
                                error.kind === 'rejected'
                                    ? 'Failure_ActionCancelled'
                                    : 'Method_Cancel',
                            message: 'Device address verification canceled.',
                        },
                    };
                }

                return addressError;
            }
        },
        async signTransaction({
            formState,
            precomposedTransaction,
            selectedAccount,
            paymentRequests,
        }) {
            if (
                !device.connected ||
                selectedAccount.deviceState !== device.state?.staticSessionId ||
                selectedAccount.symbol !== 'btc' ||
                precomposedTransaction.type !== 'final' ||
                isCardanoTx(selectedAccount, precomposedTransaction) ||
                paymentRequests?.length ||
                formState.rbfParams
            ) {
                throw new Error('Unsupported device Bitcoin transaction.');
            }

            let locktime: number | undefined;
            if (formState.bitcoinLocktimeBlockHeight) {
                locktime = new BigNumber(formState.bitcoinLocktimeBlockHeight).toNumber();
            } else if (formState.bitcoinLocktimeDatetime) {
                locktime = datetimeToLocktime(formState.bitcoinLocktimeDatetime);
            }

            try {
                return await withButtonRequest(
                    { code: 'ButtonRequest_ConfirmOutput' },
                    async () => {
                        const serializedTx = await signLedgerBitcoinTransaction({
                            account: selectedAccount,
                            transaction: precomposedTransaction,
                            signer: {
                                getAccount: index =>
                                    withCurrentConnection(() =>
                                        deps.ledgerBitcoinService.getAccount(index),
                                    ),
                                signTransaction: (index, psbt) =>
                                    withCurrentConnection(() =>
                                        deps.ledgerBitcoinService.signTransaction(index, psbt),
                                    ),
                            },
                            locktime,
                        });
                        const signedTx = selectedAccount.addresses
                            ? createPendingTransaction(Transaction.fromHex(serializedTx), {
                                  addresses: selectedAccount.addresses,
                                  inputs: precomposedTransaction.inputs,
                                  outputs: precomposedTransaction.outputs,
                              })
                            : undefined;

                        return { serializedTx, signedTx };
                    },
                );
            } catch (error) {
                if (error instanceof LedgerActionError)
                    throw new WalletDeviceActionError(error.kind);
                throw error;
            }
        },
    };
};
