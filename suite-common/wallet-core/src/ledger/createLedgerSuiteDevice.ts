import { type LedgerSuiteDevice } from '@suite-common/device';
import { type LedgerDeviceInfo } from '@suite-common/ledger';
import {
    type NetworkSymbol,
    type NetworkType,
    asNetworkSymbol,
    getNetworkType,
    getSupportedNetworks,
} from '@suite-common/wallet-config';
import { type StaticSessionId, type UnavailableCapabilities } from '@trezor/connect';
import { asDeviceUniquePath } from '@trezor/connect-common';
import { DeviceModelInternal, FirmwareType } from '@trezor/device-utils';

const networkCapabilities = {
    bitcoin: 'Capability_Bitcoin_like',
    ethereum: 'Capability_Ethereum',
    ripple: 'Capability_Ripple',
    cardano: 'Capability_Cardano',
    solana: 'Capability_Solana',
    stellar: 'Capability_Stellar',
    tron: 'Capability_Tron',
} as const satisfies Record<
    NetworkType,
    NonNullable<LedgerSuiteDevice['features']['capabilities']>[number]
>;

export type LedgerWalletIdentity = {
    id: string;
    label: string;
    staticSessionId: StaticSessionId;
    sessionId?: string;
    deviceInfo?: LedgerDeviceInfo;
    supportedNetworks?: NetworkSymbol[];
    accountsDiscoveryAppVersion?: string;
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
    'settings.rename',
    'settings.pin',
    'settings.backup',
    'settings.passphrase',
    'settings.firmwareUpdate',
    'settings.wipe',
    'settings.bluetoothPairing',
    'settings.authenticity',
    'deviceIdCheck',
    'deviceInvariabilityCheck',
    'firmwareRevisionCheck',
    'firmwareHashCheck',
] as const;

export const createLedgerSuiteDevice = (
    {
        id,
        label,
        staticSessionId,
        sessionId,
        deviceInfo,
        supportedNetworks = [asNetworkSymbol('btc')],
        accountsDiscoveryAppVersion,
    }: LedgerWalletIdentity,
    apiType: 'usb' | 'bluetooth' = 'usb',
): LedgerSuiteDevice => {
    const now = Date.now();
    const unavailableCapabilities: UnavailableCapabilities = {
        ...Object.fromEntries(
            getSupportedNetworks()
                .filter(symbol => !supportedNetworks.includes(symbol))
                .map(symbol => [symbol, 'no-support'] as const),
        ),
        ...Object.fromEntries(
            unsupportedCapabilities.map(capability => [capability, 'no-support']),
        ),
    };

    return {
        provider: 'ledger',
        type: 'acquired',
        id,
        name: label,
        label,
        ledgerInfo:
            deviceInfo || accountsDiscoveryAppVersion
                ? {
                      model: deviceInfo?.model ?? 'Ledger',
                      osVersion: deviceInfo?.osVersion,
                      bitcoinAppVersion: deviceInfo?.bitcoinAppVersion,
                      batteryLevel: deviceInfo?.batteryLevel,
                      ...(accountsDiscoveryAppVersion ? { accountsDiscoveryAppVersion } : {}),
                  }
                : undefined,
        path: asDeviceUniquePath(`ledger:${id}`),
        descriptor: { apiType, id },
        status: 'available',
        mode: 'normal',
        firmware: 'unknown',
        firmwareType: supportedNetworks.some(symbol => symbol !== 'btc')
            ? FirmwareType.Universal
            : FirmwareType.BitcoinOnly,
        state: { staticSessionId, sessionId },
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
            ...(deviceInfo?.batteryLevel !== undefined ? { soc: deviceInfo.batteryLevel } : {}),
            capabilities: [
                ...new Set(
                    supportedNetworks.map(symbol => networkCapabilities[getNetworkType(symbol)]),
                ),
            ],
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
