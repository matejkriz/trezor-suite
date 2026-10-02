import { type DeviceRootState, deviceReducerInitialState } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { type AccountsRootState, type DiscoveryRootState } from '@suite-common/wallet-core';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { type StaticSessionId } from '@trezor/connect';
import { DeviceModelInternal } from '@trezor/device-utils';

import { selectIsDeviceReadyToUse, selectIsDeviceReadyToUseAndAuthorized } from './selectors';

describe('device readiness', () => {
    it('accepts an initialized Ledger with a standard discovered Bitcoin account', () => {
        const staticSessionId: StaticSessionId = 'ledgerwallet@ledger:0';
        const selectedDevice = {
            ...mockSuiteDevice(
                {
                    name: 'My Ledger',
                    connected: true,
                    available: true,
                    mode: 'normal',
                    state: { staticSessionId },
                    unavailableCapabilities: { firmwareRevisionCheck: 'no-support' },
                },
                {
                    internal_model: DeviceModelInternal.UNKNOWN,
                    major_version: 0,
                    minor_version: 0,
                    patch_version: 0,
                    initialized: true,
                },
            ),
            provider: 'ledger' as const,
        };
        const state: DeviceRootState & AccountsRootState & DiscoveryRootState = {
            device: { ...deviceReducerInitialState, devices: [selectedDevice], selectedDevice },
            wallet: {
                accounts: [
                    mockWalletAccount({
                        symbol: asNetworkSymbol('btc'),
                        descriptor: asAccountDescriptor('xpubLedger'),
                        deviceState: staticSessionId,
                        visible: true,
                    }),
                ],
                discovery: {},
            },
        };

        expect(selectIsDeviceReadyToUse(state)).toBe(true);
        expect(selectIsDeviceReadyToUseAndAuthorized(state)).toBe(true);
    });

    it('still rejects a supported Trezor model with firmware below the minimum', () => {
        const selectedDevice = mockSuiteDevice(
            {},
            {
                internal_model: DeviceModelInternal.T3B1,
                major_version: 2,
                minor_version: 5,
                patch_version: 0,
            },
        );
        const state: DeviceRootState = { device: { ...deviceReducerInitialState, selectedDevice } };

        expect(selectIsDeviceReadyToUse(state)).toBe(false);
    });
});
