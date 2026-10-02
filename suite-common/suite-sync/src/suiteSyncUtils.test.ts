import { portfolioTrackerDevice } from '@suite-common/device';
import { type TrezorDevice } from '@suite-common/suite-types';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { type SuiteSyncInteraction } from './suiteSyncTypes';
import {
    getIsSuiteSyncLabelingActionEnabled,
    isSuiteSyncSupportedByDevice,
} from './suiteSyncUtils';

const restoredLedger = { ...mockSuiteDevice(), provider: 'ledger' as const };

describe(isSuiteSyncSupportedByDevice.name, () => {
    it.each<[TrezorDevice, boolean, string]>([
        [restoredLedger, false, 'remembered Ledger without capabilities'],
        [
            mockSuiteDevice({ unavailableCapabilities: { evolu: 'update-required' } }),
            true,
            'Trezor needing firmware upgrade',
        ],
        [portfolioTrackerDevice, false, "portfolio tracker doesn't support evolu"],
        [
            mockSuiteDevice({ unavailableCapabilities: {} }),
            true,
            'trezor device with no unavailable capabilities',
        ],
        [
            mockSuiteDevice({ unavailableCapabilities: { evolu: 'no-capability' } }),
            false,
            'trezor device with evolu unavailable',
        ],
    ])('%s should return %s', (device, expected) => {
        expect(isSuiteSyncSupportedByDevice(device)).toBe(expected);
    });
});

describe(getIsSuiteSyncLabelingActionEnabled.name, () => {
    it.each<[SuiteSyncInteraction | null, boolean, string]>([
        [null, true, 'null enables labeling action'],
        ['suite-sync-off', true, 'suite-sync-off enables labeling action'],
        ['keys-needed', true, 'keys-needed enables labeling action'],
        ['unsupported', false, 'unsupported disables labeling action'],
        ['firmware-upgrade-needed', true, 'firmware-upgrade-needed enables labeling action'],
    ])('when interaction is %s should return %s', (suiteSyncInteraction, expected) => {
        expect(getIsSuiteSyncLabelingActionEnabled(suiteSyncInteraction)).toBe(expected);
    });
});
