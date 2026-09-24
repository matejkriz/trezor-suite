import type {
    DeviceManagementKit,
    DiscoveredDevice,
    ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import {
    DefaultDescriptorTemplate,
    DefaultWallet,
    type SignPsbtDAOutput,
    type SignerBtc,
} from '@ledgerhq/device-signer-kit-bitcoin';
import type { Subscription } from 'rxjs';

import { getLedgerBitcoinAccountPath } from './ledgerBitcoinPath';
import { runLedgerAction } from './runLedgerAction';

export type LedgerBitcoinServiceDeps = {
    dmk: Pick<
        DeviceManagementKit,
        'startDiscovering' | 'stopDiscovering' | 'connect' | 'disconnect' | 'close'
    >;
    createSigner: (
        sessionId: string,
    ) => Pick<SignerBtc, 'getExtendedPublicKey' | 'getWalletAddress' | 'signPsbt'>;
};

export type LedgerBitcoinAccount = {
    path: string;
    extendedPublicKey: string;
    address: string;
};

export type LedgerBitcoinService = {
    startDiscovery: (
        onDevice: (device: DiscoveredDevice) => void,
        onError: (error: unknown) => void,
    ) => void;
    stopDiscovery: () => Promise<void>;
    connect: (device: DiscoveredDevice) => Promise<void>;
    getAccount: (index: number) => Promise<LedgerBitcoinAccount>;
    verifyAddress: (index: number, addressIndex: number) => Promise<string>;
    signPsbt: (index: number, psbt: string) => Promise<SignPsbtDAOutput>;
    disconnect: () => Promise<void>;
    dispose: () => Promise<void>;
};

export const createLedgerBitcoinService = (
    deps: LedgerBitcoinServiceDeps,
): LedgerBitcoinService => {
    let discoverySubscription: Subscription | undefined;
    let sessionId: string | undefined;
    let signer: ReturnType<LedgerBitcoinServiceDeps['createSigner']> | undefined;
    let activeActionCancel: (() => void) | undefined;

    const stopDiscovery = async () => {
        if (!discoverySubscription) return;

        discoverySubscription.unsubscribe();
        discoverySubscription = undefined;
        await deps.dmk.stopDiscovering();
    };

    const getSigner = () => {
        if (!signer) throw new Error('Ledger device is not connected');

        return signer;
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

    const disconnect = async () => {
        activeActionCancel?.();
        activeActionCancel = undefined;
        await stopDiscovery();

        if (sessionId) {
            const previousSessionId = sessionId;
            sessionId = undefined;
            signer = undefined;
            await deps.dmk.disconnect({ sessionId: previousSessionId });
        }
    };

    return {
        startDiscovery(onDevice, onError) {
            if (discoverySubscription && !discoverySubscription.closed) return;

            const subscription = deps.dmk.startDiscovering({}).subscribe({
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
            await stopDiscovery();

            if (sessionId) {
                const previousSessionId = sessionId;
                sessionId = undefined;
                signer = undefined;
                await deps.dmk.disconnect({ sessionId: previousSessionId });
            }

            sessionId = await deps.dmk.connect({ device });
            signer = deps.createSigner(sessionId);
        },
        async getAccount(index) {
            const bitcoinSigner = getSigner();
            const path = getLedgerBitcoinAccountPath(index);
            const wallet = new DefaultWallet(path, DefaultDescriptorTemplate.NATIVE_SEGWIT);
            const { extendedPublicKey } = await runAction(bitcoinSigner.getExtendedPublicKey(path));
            const { address } = await runAction(bitcoinSigner.getWalletAddress(wallet, 0));

            return { path, extendedPublicKey, address };
        },
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
