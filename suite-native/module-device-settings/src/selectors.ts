import { type DeviceRootState, isLedgerDevice, selectSelectedDevice } from '@suite-common/device';
import { createWeakMapSelector } from '@suite-common/redux-utils';
import { type ThpRootState, selectThpCredentials } from '@suite-common/thp';
import { type TxKeyPath } from '@suite-native/intl';

type DeviceInformationItem = {
    title: TxKeyPath;
    value: string;
};

export const selectDeviceSettingsInformation = createWeakMapSelector(
    [selectSelectedDevice],
    (device): DeviceInformationItem[] => {
        if (!isLedgerDevice(device) || !device.ledgerInfo) return [];

        const { model, osVersion, bitcoinAppVersion, batteryLevel } = device.ledgerInfo;
        const information: DeviceInformationItem[] = [
            { title: 'moduleDeviceSettings.deviceInfo.model', value: model },
        ];

        if (osVersion) {
            information.push({
                title: 'moduleDeviceSettings.deviceInfo.osVersion',
                value: osVersion,
            });
        }
        if (bitcoinAppVersion) {
            information.push({
                title: 'moduleDeviceSettings.deviceInfo.bitcoinAppVersion',
                value: bitcoinAppVersion,
            });
        }
        if (batteryLevel !== undefined) {
            information.push({
                title: 'moduleDeviceSettings.deviceInfo.batteryLevel',
                value: `${batteryLevel}%`,
            });
        }

        return information;
    },
);

const createMemoizedSelector = createWeakMapSelector.withTypes<DeviceRootState & ThpRootState>();

// Deprecated: Temporary hack until THP credentials are migrated to THP reducer.
export const selectDeviceAutoConnectCredentials = createMemoizedSelector(
    [selectSelectedDevice, selectThpCredentials],
    (device, thpCredentials) =>
        device?.thp?.credentials.filter(
            c => c.autoconnect && thpCredentials.some(tc => tc.credential === c.credential),
        ) ?? [],
);
