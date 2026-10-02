import { deviceActions } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { accountsActions } from '@suite-common/wallet-core';
import {
    type Account,
    type DiscoveryStatus,
    asAccountDescriptor,
} from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { type DeviceUniquePath, type StaticSessionId } from '@trezor/connect';

import {
    REDACTED_REPLACEMENT,
    redactAccount,
    redactAction,
    redactDevice,
    redactDiscovery,
} from './utils';

describe('logsUtils', () => {
    const account = mockWalletAccount({
        deviceState: '1stTestnetAddress@device_id:0',
        descriptor: asAccountDescriptor(
            'zpub6rszzdAK6RuafeRwyN8z1cgWcXCuKbLmjjfnrW4fWKtcoXQ8787214pNJjnBG5UATyghuNzjn6Lfp5k5xymrLFJnCy46bMYJPyZsbpFGagT',
        ),
        symbol: asNetworkSymbol('btc'),
    });
    const device = mockSuiteDevice();

    describe('redactAccount', () => {
        it('should redact sensitive fields on account', () => {
            expect(redactAccount(account)).toEqual({
                ...account,
                descriptor: REDACTED_REPLACEMENT,
                addresses: REDACTED_REPLACEMENT,
                balance: REDACTED_REPLACEMENT,
                availableBalance: REDACTED_REPLACEMENT,
                formattedBalance: REDACTED_REPLACEMENT,
                history: REDACTED_REPLACEMENT,
                deviceState: REDACTED_REPLACEMENT,
                utxo: REDACTED_REPLACEMENT,
                metadata: REDACTED_REPLACEMENT,
                key: REDACTED_REPLACEMENT,
            });
        });
    });

    describe('redactDevice', () => {
        it('redacts a custom Ledger name and wallet-derived transport identifiers', () => {
            const ledgerDevice = {
                ...device,
                provider: 'ledger',
                name: 'private-name',
                path: 'ledger:private-id' as DeviceUniquePath,
                descriptor: { apiType: 'usb' as const, id: 'private-id' },
                ledgerInfo: { name: 'private-name', model: 'Ledger Flex' },
            };
            const serialized = JSON.stringify(redactDevice(ledgerDevice));

            expect(serialized).not.toContain('private-name');
            expect(serialized).not.toContain('private-id');
        });
        it('should redact sensitive fields on device', () => {
            expect(redactDevice(device)).toEqual({
                ...device,
                name: REDACTED_REPLACEMENT,
                path: REDACTED_REPLACEMENT,
                descriptor: { ...device.descriptor, id: REDACTED_REPLACEMENT },
                id: REDACTED_REPLACEMENT,
                label: REDACTED_REPLACEMENT,
                firmwareReleaseConfigInfo: REDACTED_REPLACEMENT,
                state: REDACTED_REPLACEMENT,
                metadata: REDACTED_REPLACEMENT,
                features: {
                    ...device.features,
                    device_id: REDACTED_REPLACEMENT,
                    session_id: REDACTED_REPLACEMENT,
                    label: REDACTED_REPLACEMENT,
                },
            });
        });
    });

    describe('redactAction', () => {
        it('redacts a device nested in the common connection event', () => {
            const entry = {
                datetime: 'Thu, 01 Jan 1970 00:00:00 GMT',
                type: deviceActions.connectDevice.type,
                payload: { device: { ...device, name: 'private-name' } },
            };

            expect(JSON.stringify(redactAction(entry))).not.toContain('private-name');
        });
        it('redacts a Ledger acquisition log entry', () => {
            const ledgerDevice = {
                ...device,
                provider: 'ledger',
                name: 'private-name',
                deviceInfo: { model: 'private-info' },
            };
            const entry = {
                datetime: 'Thu, 01 Jan 1970 00:00:00 GMT',
                type: deviceActions.registerDevice.type,
                payload: ledgerDevice,
            };

            expect(JSON.stringify(redactAction(entry))).not.toContain('private-name');
            expect(JSON.stringify(redactAction(entry))).not.toContain('private-info');
        });
        it('redacts the account of an updateSelectedAccount log entry', () => {
            const entry = {
                datetime: 'Thu, 01 Jan 1970 00:00:00 GMT',
                type: accountsActions.updateSelectedAccount.type,
                payload: { account },
            };

            const redactedAccount = (redactAction(entry).payload as { account: Account }).account;

            expect(redactedAccount.descriptor).toBe(REDACTED_REPLACEMENT);
            expect(redactedAccount.deviceState).toBe(REDACTED_REPLACEMENT);
        });
    });

    describe(redactDiscovery.name, () => {
        it('redacts duplicate static session id for duplicate passphrase discovery', () => {
            const duplicateDeviceStaticSessionId: StaticSessionId = 'session@device-id:1';
            const discovery: DiscoveryStatus = {
                status: 'passphrase-duplicate',
                duplicateDeviceStaticSessionId,
            };

            expect(redactDiscovery(discovery)).toEqual({
                ...discovery,
                duplicateDeviceStaticSessionId: REDACTED_REPLACEMENT,
            });
        });

        it('keeps other discovery statuses unchanged', () => {
            const discovery: DiscoveryStatus = {
                status: 'progress',
                progress: 1,
                total: 3,
            };

            expect(redactDiscovery(discovery)).toEqual(discovery);
        });

        it('keeps undefined value', () => {
            expect(redactDiscovery(undefined)).toEqual(undefined);
        });
    });
});
