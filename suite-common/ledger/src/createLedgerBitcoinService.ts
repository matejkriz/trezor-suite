import type {
    DeviceManagementKit,
    DiscoveredDevice,
    ExecuteDeviceActionReturnType,
    GoToDashboardDAError,
    GoToDashboardDAIntermediateValue,
    OpenAppDAError,
    OpenAppDAIntermediateValue,
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

import {
    type LedgerAccountsDiscoveryService,
    createLedgerAccountsDiscoveryService,
} from './createLedgerAccountsDiscoveryService';
import { getLedgerBitcoinAccountPath } from './ledgerBitcoinPath';
import { readLedgerDeviceName } from './readLedgerDeviceName';
import { LedgerActionError, runLedgerAction } from './runLedgerAction';

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
        | 'sendApdu'
        | 'getDeviceSessionState'
        | 'disconnect'
        | 'close'
    >;
    goToDashboard: (
        sessionId: string,
    ) => ExecuteDeviceActionReturnType<
        void,
        GoToDashboardDAError,
        GoToDashboardDAIntermediateValue
    >;
    openAccountsDiscoveryApp: (
        sessionId: string,
    ) => ExecuteDeviceActionReturnType<void, OpenAppDAError, OpenAppDAIntermediateValue>;
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

export type LedgerDeviceInfo = {
    name: string;
    model: string;
    osVersion?: string;
    bitcoinAppVersion?: string;
    batteryLevel?: number;
};

export type LedgerBitcoinService = {
    listenToAvailableDevices: (
        onDevices: (devices: DiscoveredDevice[]) => void,
        onError: (error: unknown) => void,
    ) => () => void;
    startDiscovery: (
        onDevice: (device: DiscoveredDevice) => void,
        onError: (error: unknown) => void,
    ) => () => Promise<void>;
    stopDiscovery: () => Promise<void>;
    connect: (device: DiscoveredDevice, options?: { owner?: string }) => Promise<void>;
    isConnectionOwner: (owner: string) => boolean;
    getDeviceInfo: () => LedgerDeviceInfo | undefined;
    getMasterFingerprint: () => Promise<string>;
    getAccount: (index: number) => Promise<LedgerBitcoinAccount>;
    openAccountsDiscovery: () => Promise<LedgerAccountsDiscoveryService>;
    verifyAddress: (index: number, addressIndex: number) => Promise<string>;
    signPsbt: (index: number, psbt: string) => Promise<SignPsbtDAOutput>;
    signTransaction: (index: number, psbt: string) => Promise<string>;
    cancelAction: (reason?: 'cancelled' | 'timeout') => void;
    disconnect: (options?: { owner?: string }) => Promise<void>;
    dispose: () => Promise<void>;
};

type RunningAction = {
    cancel: () => void;
    cancelReason?: 'cancelled' | 'timeout';
};

export const createLedgerBitcoinService = (
    deps: LedgerBitcoinServiceDeps,
): LedgerBitcoinService => {
    let discoverySubscription: Subscription | undefined;
    let isDiscoveryStarted = false;
    let discoveryRevision = 0;
    let availableDevicesSubscription: Subscription | undefined;
    let sessionStateSubscription: Subscription | undefined;
    let sessionId: string | undefined;
    let connectionRevision = 0;
    let connectionOwner: string | undefined;
    let deviceInfo: LedgerDeviceInfo | undefined;
    let isEmulated = false;
    let signer: ReturnType<LedgerBitcoinServiceDeps['createSigner']> | undefined;
    let activeAction: RunningAction | undefined;
    let physicalConnectionQueue = Promise.resolve();

    const queuePhysicalConnection = <Result>(operation: () => Promise<Result>): Promise<Result> => {
        const result = physicalConnectionQueue.then(operation);
        physicalConnectionQueue = result.then(
            () => undefined,
            () => undefined,
        );

        return result;
    };

    const stopAvailableDevicesListening = () => {
        availableDevicesSubscription?.unsubscribe();
        availableDevicesSubscription = undefined;
    };

    const stopDiscovery = async () => {
        discoveryRevision++;
        if (!isDiscoveryStarted) return;

        isDiscoveryStarted = false;
        discoverySubscription?.unsubscribe();
        discoverySubscription = undefined;
        stopAvailableDevicesListening();
        await deps.dmk.stopDiscovering();
    };

    const stopOwnedDiscovery = (revision: number) => {
        if (revision !== discoveryRevision) return Promise.resolve();

        return stopDiscovery();
    };

    const getSigner = () => {
        if (!signer) throw new Error('Ledger device is not connected');

        return signer;
    };

    const clearSession = () => {
        if (!sessionId) return;

        if (activeAction) {
            activeAction.cancelReason = 'cancelled';
            activeAction.cancel();
            activeAction = undefined;
        }
        sessionStateSubscription?.unsubscribe();
        sessionStateSubscription = undefined;
        sessionId = undefined;
        deviceInfo = undefined;
        signer = undefined;
        deps.onDisconnect?.();
    };

    const runAction = async <Output, ActionError, IntermediateValue>(
        action: ExecuteDeviceActionReturnType<Output, ActionError, IntermediateValue>,
    ): Promise<Output> => {
        if (activeAction) throw new Error('Ledger action already in progress');

        const runningAction: RunningAction = { cancel: action.cancel };
        const revision = connectionRevision;
        activeAction = runningAction;

        try {
            const output = await runLedgerAction(action);
            if (runningAction.cancelReason) throw new LedgerActionError(runningAction.cancelReason);
            if (revision !== connectionRevision) throw new LedgerActionError('cancelled');

            return output;
        } catch (error) {
            if (runningAction.cancelReason) throw new LedgerActionError(runningAction.cancelReason);
            throw error;
        } finally {
            if (activeAction === runningAction) activeAction = undefined;
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

    const disconnect: LedgerBitcoinService['disconnect'] = async (options = {}) => {
        if (options.owner !== undefined && options.owner !== connectionOwner) return;

        connectionRevision++;
        connectionOwner = undefined;
        stopAvailableDevicesListening();
        const previousSessionId = sessionId;
        clearSession();

        await queuePhysicalConnection(async () => {
            try {
                await stopDiscovery();
            } finally {
                if (previousSessionId) {
                    await deps.dmk.disconnect({ sessionId: previousSessionId });
                }
            }
        });
    };

    return {
        listenToAvailableDevices(onDevices, onError) {
            stopAvailableDevicesListening();
            const revision = ++discoveryRevision;
            isDiscoveryStarted = true;

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
                void stopOwnedDiscovery(revision).catch(() => undefined);
            };
        },
        startDiscovery(onDevice, onError) {
            const revision = ++discoveryRevision;
            discoverySubscription?.unsubscribe();
            discoverySubscription = undefined;

            isDiscoveryStarted = true;
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

            return () => stopOwnedDiscovery(revision);
        },
        stopDiscovery,
        async connect(device, options = {}) {
            const revision = ++connectionRevision;
            isEmulated = device.transport === 'SPECULOS_HTTP_TRANSPORT';
            connectionOwner = options.owner;
            stopAvailableDevicesListening();
            const previousSessionId = sessionId;
            clearSession();

            const connectedSessionId = await queuePhysicalConnection(async () => {
                try {
                    await stopDiscovery();
                } finally {
                    if (previousSessionId) {
                        await deps.dmk.disconnect({ sessionId: previousSessionId });
                    }
                }

                if (revision !== connectionRevision) throw new Error('Ledger connection canceled');
                const newSessionId = await deps.dmk.connect({ device });
                if (revision !== connectionRevision) {
                    await deps.dmk.disconnect({ sessionId: newSessionId });
                    throw new Error('Ledger connection canceled');
                }
                sessionId = newSessionId;
                deviceInfo = { name: 'Ledger', model: device.deviceModel.name };
                signer = deps.createSigner(sessionId);
                const handleSessionEnd = () => {
                    if (sessionId !== newSessionId) return;

                    if (revision === connectionRevision) {
                        connectionRevision++;
                        connectionOwner = undefined;
                    }
                    clearSession();
                };
                const subscription = deps.dmk
                    .getDeviceSessionState({
                        sessionId: newSessionId,
                    })
                    .subscribe({
                        next: state => {
                            if (sessionId !== newSessionId) return;

                            if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
                                handleSessionEnd();

                                return;
                            }

                            const info = deviceInfo;
                            if (!info) return;

                            deviceInfo = {
                                ...info,
                                ...('firmwareVersion' in state && state.firmwareVersion
                                    ? { osVersion: state.firmwareVersion.os }
                                    : {}),
                                ...('currentApp' in state && state.currentApp.name === 'Bitcoin'
                                    ? { bitcoinAppVersion: state.currentApp.version }
                                    : {}),
                                ...('batteryStatus' in state && state.batteryStatus
                                    ? { batteryLevel: state.batteryStatus.level }
                                    : {}),
                            };
                        },
                        error: handleSessionEnd,
                        complete: handleSessionEnd,
                    });
                if (revision === connectionRevision && sessionId === newSessionId) {
                    sessionStateSubscription = subscription.closed ? undefined : subscription;
                } else {
                    subscription.unsubscribe();
                }

                return newSessionId;
            });
            if (revision !== connectionRevision || sessionId !== connectedSessionId) {
                throw new Error('Ledger connection canceled');
            }

            // Speculos runs an application ELF without the device OS/dashboard.
            if (device.transport !== 'SPECULOS_HTTP_TRANSPORT') {
                await runAction(deps.goToDashboard(connectedSessionId));
                if (revision !== connectionRevision) throw new Error('Ledger connection canceled');
                const name = await readLedgerDeviceName(deps, connectedSessionId);
                if (revision !== connectionRevision) throw new Error('Ledger connection canceled');
                if (sessionId !== connectedSessionId || !deviceInfo) {
                    throw new Error('Ledger disconnected while reading device information');
                }
                deviceInfo = { ...deviceInfo, name: name ?? 'Ledger' };
            }
        },
        isConnectionOwner: owner => owner === connectionOwner,
        getDeviceInfo: () => deviceInfo,
        async openAccountsDiscovery() {
            const connectedSessionId = sessionId;
            const revision = connectionRevision;
            if (!connectedSessionId) throw new Error('Ledger device is not connected');
            if (!isEmulated) await runAction(deps.openAccountsDiscoveryApp(connectedSessionId));
            if (revision !== connectionRevision) throw new LedgerActionError('cancelled');

            return createLedgerAccountsDiscoveryService({
                dmk: deps.dmk,
                getSessionId: () => (revision === connectionRevision ? sessionId : undefined),
            });
        },
        async getAccount(index) {
            const bitcoinSigner = getSigner();
            const revision = connectionRevision;
            const ensureCurrentConnection = () => {
                if (revision !== connectionRevision) throw new LedgerActionError('cancelled');
            };
            const path = getLedgerBitcoinAccountPath(index);
            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);
            const { extendedPublicKey } = await runAction(bitcoinSigner.getExtendedPublicKey(path));
            ensureCurrentConnection();
            const { address } = await runAction(bitcoinSigner.getWalletAddress(wallet, 0));
            ensureCurrentConnection();
            const descriptor = getNativeSegwitDescriptor(extendedPublicKey);
            const derivedAddress = deriveAddresses(descriptor, 'receive', 0, 1)[0]?.address;

            if (derivedAddress !== address) {
                throw new Error('Ledger account public key does not match its first address');
            }

            const masterFingerprint = await getMasterFingerprint();
            ensureCurrentConnection();

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
        cancelAction: (reason = 'cancelled') => {
            if (!activeAction) return;

            activeAction.cancelReason = reason;
            activeAction.cancel();
        },
        async dispose() {
            try {
                await disconnect();
            } finally {
                deps.dmk.close();
            }
        },
    };
};
