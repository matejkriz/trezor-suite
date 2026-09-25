import type {
    DeviceManagementKit,
    DiscoveredDevice,
    ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import { DeviceStatus } from '@ledgerhq/device-management-kit';
import {
    DefaultDescriptorTemplate,
    DefaultWallet,
    type SignPsbtDAOutput,
    type SignerBtc,
} from '@ledgerhq/device-signer-kit-bitcoin';
import { type Observable, type Subscription, mergeMap } from 'rxjs';

import { bip32, deriveAddresses, networks } from '@trezor/utxo-lib';

import { getLedgerBitcoinAccountPath } from './ledgerBitcoinPath';
import { runLedgerAction } from './runLedgerAction';

const bitcoinNativeSegwitNetwork = {
    ...networks.bitcoin,
    bip32: {
        ...networks.bitcoin.bip32,
        public: 0x04b24746,
    },
};

const getNativeSegwitDescriptor = (extendedPublicKey: string): string => {
    const accountNode = bip32.fromBase58(extendedPublicKey, networks.bitcoin);

    if (!accountNode.isNeutered() || accountNode.depth !== 3) {
        throw new Error('Ledger returned an invalid Bitcoin account public key');
    }

    accountNode.network = bitcoinNativeSegwitNetwork;

    return accountNode.toBase58();
};

export type LedgerBitcoinServiceDeps = {
    dmk: Pick<
        DeviceManagementKit,
        | 'startDiscovering'
        | 'listenToAvailableDevices'
        | 'stopDiscovering'
        | 'connect'
        | 'getDeviceSessionState'
        | 'disconnect'
        | 'close'
    >;
    listenToAvailableDevices?: () => Observable<DiscoveredDevice[]>;
    createSigner: (
        sessionId: string,
    ) => Pick<
        SignerBtc,
        | 'getExtendedPublicKey'
        | 'getMasterFingerprint'
        | 'getWalletAddress'
        | 'signPsbt'
        | 'signTransaction'
    >;
    onDisconnect?: () => void;
};

export type LedgerBitcoinAccount = {
    path: string;
    extendedPublicKey: string;
    descriptor: string;
    masterFingerprint: string;
    address: string;
};

export type LedgerBitcoinService = {
    listenToAvailableDevices: (
        onDevices: (devices: DiscoveredDevice[]) => void,
        onError: (error: unknown) => void,
    ) => () => void;
    startDiscovery: (
        onDevice: (device: DiscoveredDevice) => void,
        onError: (error: unknown) => void,
    ) => void;
    stopDiscovery: () => Promise<void>;
    connect: (device: DiscoveredDevice) => Promise<void>;
    getMasterFingerprint: () => Promise<string>;
    getAccount: (index: number) => Promise<LedgerBitcoinAccount>;
    verifyAddress: (index: number, addressIndex: number) => Promise<string>;
    signPsbt: (index: number, psbt: string) => Promise<SignPsbtDAOutput>;
    signTransaction: (index: number, psbt: string) => Promise<string>;
    disconnect: () => Promise<void>;
    dispose: () => Promise<void>;
};

export const createLedgerBitcoinService = (
    deps: LedgerBitcoinServiceDeps,
): LedgerBitcoinService => {
    let discoverySubscription: Subscription | undefined;
    let availableDevicesSubscription: Subscription | undefined;
    let sessionStateSubscription: Subscription | undefined;
    let sessionId: string | undefined;
    let signer: ReturnType<LedgerBitcoinServiceDeps['createSigner']> | undefined;
    let activeActionCancel: (() => void) | undefined;

    const stopDiscovery = async () => {
        if (!discoverySubscription) return;

        discoverySubscription.unsubscribe();
        discoverySubscription = undefined;
        await deps.dmk.stopDiscovering();
    };

    const stopAvailableDevicesListening = () => {
        availableDevicesSubscription?.unsubscribe();
        availableDevicesSubscription = undefined;
    };

    const getSigner = () => {
        if (!signer) throw new Error('Ledger device is not connected');

        return signer;
    };

    const clearSession = () => {
        if (!sessionId) return;

        activeActionCancel?.();
        activeActionCancel = undefined;
        sessionStateSubscription?.unsubscribe();
        sessionStateSubscription = undefined;
        sessionId = undefined;
        signer = undefined;
        deps.onDisconnect?.();
    };

    const runAction = async <Output, ActionError, IntermediateValue>(
        action: ExecuteDeviceActionReturnType<Output, ActionError, IntermediateValue>,
    ): Promise<Output> => {
        if (activeActionCancel) throw new Error('Ledger action already in progress');

        activeActionCancel = action.cancel;

        try {
            return await runLedgerAction(action);
        } finally {
            if (activeActionCancel === action.cancel) activeActionCancel = undefined;
        }
    };

    const getMasterFingerprint = async (): Promise<string> => {
        const bitcoinSigner = getSigner();
        const { masterFingerprint } = await runAction(bitcoinSigner.getMasterFingerprint());

        if (masterFingerprint.length !== 4) {
            throw new Error('Ledger returned an invalid Bitcoin master fingerprint');
        }

        return Array.from(masterFingerprint, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    const disconnect = async () => {
        stopAvailableDevicesListening();
        await stopDiscovery();

        if (sessionId) {
            const previousSessionId = sessionId;
            clearSession();
            await deps.dmk.disconnect({ sessionId: previousSessionId });
        }
    };

    return {
        listenToAvailableDevices(onDevices, onError) {
            stopAvailableDevicesListening();

            const subscription = deps.dmk.listenToAvailableDevices({}).subscribe({
                next: onDevices,
                error: onError,
            });
            availableDevicesSubscription = subscription.closed ? undefined : subscription;

            return () => {
                subscription.unsubscribe();
                if (availableDevicesSubscription === subscription) {
                    availableDevicesSubscription = undefined;
                }
            };
        },
        startDiscovery(onDevice, onError) {
            if (discoverySubscription && !discoverySubscription.closed) return;

            const devices$ = deps.listenToAvailableDevices
                ? deps.listenToAvailableDevices().pipe(mergeMap(devices => devices))
                : deps.dmk.startDiscovering({});
            const subscription = devices$.subscribe({
                next: onDevice,
                error: error => {
                    discoverySubscription = undefined;
                    onError(error);
                },
                complete: () => {
                    discoverySubscription = undefined;
                },
            });
            discoverySubscription = subscription.closed ? undefined : subscription;
        },
        stopDiscovery,
        async connect(device) {
            stopAvailableDevicesListening();
            await stopDiscovery();

            if (sessionId) {
                const previousSessionId = sessionId;
                clearSession();
                await deps.dmk.disconnect({ sessionId: previousSessionId });
            }

            sessionId = await deps.dmk.connect({ device });
            signer = deps.createSigner(sessionId);
            const connectedSessionId = sessionId;
            const subscription = deps.dmk
                .getDeviceSessionState({
                    sessionId: connectedSessionId,
                })
                .subscribe({
                    next: state => {
                        if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) clearSession();
                    },
                    error: () => {
                        if (sessionId === connectedSessionId) clearSession();
                    },
                    complete: () => {
                        if (sessionId === connectedSessionId) clearSession();
                    },
                });
            sessionStateSubscription = subscription.closed ? undefined : subscription;
        },
        async getAccount(index) {
            const bitcoinSigner = getSigner();
            const path = getLedgerBitcoinAccountPath(index);
            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);
            const { extendedPublicKey } = await runAction(bitcoinSigner.getExtendedPublicKey(path));
            const { address } = await runAction(bitcoinSigner.getWalletAddress(wallet, 0));
            const descriptor = getNativeSegwitDescriptor(extendedPublicKey);
            const derivedAddress = deriveAddresses(descriptor, 'receive', 0, 1)[0]?.address;

            if (derivedAddress !== address) {
                throw new Error('Ledger account public key does not match its first address');
            }

            const masterFingerprint = await getMasterFingerprint();

            return { path, extendedPublicKey, descriptor, masterFingerprint, address };
        },
        getMasterFingerprint,
        async verifyAddress(index, addressIndex) {
            const bitcoinSigner = getSigner();
            const path = getLedgerBitcoinAccountPath(index);

            if (
                !Number.isSafeInteger(addressIndex) ||
                addressIndex < 0 ||
                addressIndex >= 0x80000000
            ) {
                throw new Error('Invalid Bitcoin address index');
            }

            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);
            const { address } = await runAction(
                bitcoinSigner.getWalletAddress(wallet, addressIndex, { checkOnDevice: true }),
            );

            return address;
        },
        signPsbt(index, psbt) {
            const bitcoinSigner = getSigner();
            const path = getLedgerBitcoinAccountPath(index);
            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);

            return runAction(bitcoinSigner.signPsbt(wallet, psbt));
        },
        async signTransaction(index, psbt) {
            const bitcoinSigner = getSigner();
            const path = getLedgerBitcoinAccountPath(index);
            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);
            const serializedTransaction = await runAction(
                bitcoinSigner.signTransaction(wallet, psbt),
            );

            if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(serializedTransaction)) {
                throw new Error('Ledger returned an invalid serialized Bitcoin transaction');
            }

            return serializedTransaction.slice(2);
        },
        disconnect,
        async dispose() {
            try {
                await disconnect();
            } finally {
                deps.dmk.close();
            }
        },
    };
};
