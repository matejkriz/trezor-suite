import { type LedgerSuiteDevice } from '@suite-common/device';
import { getSupportedNetworks } from '@suite-common/wallet-config';
import { type StaticSessionId, type UnavailableCapabilities } from '@trezor/connect';
import { asDeviceUniquePath } from '@trezor/connect-common';
import { DeviceModelInternal } from '@trezor/device-utils';

export type LedgerWalletIdentity = {
    id: string;
    label: string;
    staticSessionId: StaticSessionId;
};

const unsupportedCapabilities = [
    'replaceTransaction',
    'amountUnit',
    'decreaseOutput',
    'eip1559',
    'eip7702',
    'taproot',
    'signMessageNoScriptType',
    'eip712-domain-only',
    'coinjoin',
    'tutorial',
    'tropicDeviceAuthentication',
    'mcuDeviceAuthentication',
    'authenticityProofChunk',
    'getFirmwareHash',
    'chunkify',
    'entropyCheck',
    'evmApproval',
    'slip24',
    'evolu',
    'monero',
    'telemetry',
    'evmClearSigning',
    'legacy',
    'segwit',
] as const;

const unavailableCapabilities: UnavailableCapabilities = {
    ...Object.fromEntries(
        getSupportedNetworks()
            .filter(symbol => symbol !== 'btc')
            .map(symbol => [symbol, 'no-support'] as const),
    ),
    ...Object.fromEntries(unsupportedCapabilities.map(capability => [capability, 'no-support'])),
};

export const createLedgerSuiteDevice = ({
    id,
    label,
    staticSessionId,
}: LedgerWalletIdentity): LedgerSuiteDevice => {
    const now = Date.now();

    return {
        provider: 'ledger',
        type: 'acquired',
        id,
        name: label,
        label,
        path: asDeviceUniquePath(`ledger:${id}`),
        descriptor: { apiType: 'usb', id },
        status: 'available',
        mode: 'normal',
        firmware: 'unknown',
        state: { staticSessionId },
        features: {
            vendor: 'Ledger',
            model: 'Ledger',
            internal_model: DeviceModelInternal.UNKNOWN,
            major_version: 0,
            minor_version: 0,
            patch_version: 0,
            device_id: id,
            label,
            initialized: true,
            unlocked: true,
            pin_protection: true,
            passphrase_protection: false,
            backup_availability: 'NotAvailable',
            capabilities: ['Capability_Bitcoin_like'],
        },
        unavailableCapabilities,
        availableTranslations: {},
        authenticityChecks: { firmwareRevision: null, firmwareHash: null },
        connected: true,
        available: true,
        discovered: true,
        remember: true,
        useEmptyPassphrase: true,
        instance: 0,
        walletNumber: 0,
        ts: now,
        firstConnectedTimestamp: now,
        buttonRequests: [],
        metadata: {},
        passwords: {},
    };
};
