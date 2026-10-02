import { type LedgerSuiteDevice, deviceActions } from '@suite-common/device';
import {
    LedgerAccountsDiscoveryError,
    LedgerActionError,
    getLedgerBitcoinAccountPath,
} from '@suite-common/ledger';
import { type ButtonRequest } from '@suite-common/suite-types';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type Account } from '@suite-common/wallet-types';
import { datetimeToLocktime, isCardanoTx } from '@suite-common/wallet-utils';
import { validatePath } from '@trezor/connect-common';
import { createPendingTransaction } from '@trezor/connect-core/src/bitcoin';
import { BigNumber } from '@trezor/utils';
import { Transaction } from '@trezor/utxo-lib';

import { WalletDeviceActionError } from './walletDeviceError';
import { type WalletDeviceOperations, type WalletDeviceServiceDeps } from './walletDeviceTypes';
import { discoverLedgerBitcoinWallet } from '../ledger/discoverLedgerBitcoinWallet';
import { discoverLedgerWalletWithAccountsApp } from '../ledger/discoverLedgerWalletWithAccountsApp';
import { signLedgerBitcoinTransaction } from '../send/signLedgerBitcoinTransaction';

type LedgerWalletDeviceOperationsDeps = WalletDeviceServiceDeps;

const isSupportedBitcoinAccount = (account: Account): boolean =>
    account.symbol === 'btc' &&
    account.networkType === 'bitcoin' &&
    account.accountType === 'normal' &&
    Number.isSafeInteger(account.index) &&
    account.index >= 0 &&
    account.index < 0x80000000 &&
    account.path === `m/${getLedgerBitcoinAccountPath(account.index)}`;

const addressError = {
    success: false as const,
    error: { message: 'Device address verification failed.', code: 'Failure_UnknownCode' as const },
};

export const createLedgerWalletDeviceOperations = (
    deps: LedgerWalletDeviceOperationsDeps,
    device: LedgerSuiteDevice,
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
        discoverAccounts: ({ networkSymbols, signal, getAccountInfo }) =>
            withCurrentConnection(async () => {
                if (networkSymbols.length === 0) return { accounts: [], failedNetworks: [] };
                const discovered = device.ledgerInfo?.accountsDiscoveryAppVersion
                    ? await discoverLedgerWalletWithAccountsApp(
                          { ledgerBitcoinService: deps.ledgerBitcoinService, getAccountInfo },
                          { networkSymbols, signal, owner },
                      )
                    : await discoverLedgerBitcoinWallet(
                          {
                              ledgerBitcoinService: deps.ledgerBitcoinService,
                              getAccountInfo: descriptor =>
                                  getAccountInfo({ symbol: asNetworkSymbol('btc'), descriptor }),
                          },
                          { signal, owner },
                      );
                if (
                    discovered.wallet.id !== device.id ||
                    discovered.wallet.staticSessionId !== device.state.staticSessionId
                ) {
                    throw new Error('Device returned a different wallet');
                }

                return {
                    accounts: discovered.accounts,
                    failedNetworks: discovered.failedNetworks ?? [],
                };
            }).catch(error => {
                if (error instanceof LedgerActionError)
                    throw new WalletDeviceActionError(error.kind);
                if (error instanceof LedgerAccountsDiscoveryError && error.code === 'rejected') {
                    throw new WalletDeviceActionError('rejected');
                }
                throw error;
            }),
        getAccountCapabilities: account => {
            const isSupported = isSupportedBitcoinAccount(account);

            return { canSignTransaction: isSupported, canConfirmAddress: isSupported };
        },
        async confirmAddress({ account, addressPath }) {
            if (
                !device.connected ||
                account.deviceState !== device.state?.staticSessionId ||
                !isSupportedBitcoinAccount(account)
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
                !isSupportedBitcoinAccount(selectedAccount) ||
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
