import {
    selectDevices,
    selectSelectedDevice,
    selectSelectedExternalWallet,
} from '@suite-common/device';
import * as deviceUtils from '@suite-common/suite-utils';
import { getDeviceInternalModel } from '@suite-common/suite-utils';
import { Icon, Row, Text, Tooltip } from '@trezor/components';
import { CableUsbCIcon } from '@trezor/icons';

import { useSelector } from 'src/hooks/suite';
import { useResponsiveContext } from 'src/support/suite/ResponsiveContext';
import { type TrezorDevice } from 'src/types/suite';

import { DeviceStatus } from './DeviceStatus';

const needsRefresh = (device?: TrezorDevice) => {
    if (!device?.connected) return false;

    const deviceStatus = deviceUtils.getStatus(device);
    const needsAcquire = [
        'unacquired',
        'used-in-other-window',
        'was-used-in-other-window',
    ].includes(deviceStatus);

    return needsAcquire;
};

export const SidebarDeviceStatus = () => {
    const selectedDevice = useSelector(selectSelectedDevice);
    const selectedExternalWallet = useSelector(selectSelectedExternalWallet);
    const devices = useSelector(selectDevices);
    const { isSidebarCollapsed } = useResponsiveContext();

    const deviceNeedsRefresh = needsRefresh(selectedDevice);

    const selectedDeviceModelInternal = getDeviceInternalModel(selectedDevice);

    if (selectedExternalWallet) {
        const content = (
            <Row gap={12} alignItems="center" overflow="hidden">
                <Icon as={CableUsbCIcon} size={24} />
                {!isSidebarCollapsed && (
                    <Text textWrap="nowrap">{selectedExternalWallet.label}</Text>
                )}
            </Row>
        );

        return isSidebarCollapsed ? (
            <Tooltip content={selectedExternalWallet.label}>{content}</Tooltip>
        ) : (
            content
        );
    }

    if (!selectedDevice || !selectedDeviceModelInternal) {
        return null;
    }
    const instances = deviceUtils.getDeviceInstances(selectedDevice, devices);
    const instancesWithState = instances.filter(i => i.state);

    const isConnectionShown =
        instancesWithState.length === 1 && selectedDevice.useEmptyPassphrase === true;

    return (
        <DeviceStatus
            deviceModel={selectedDeviceModelInternal}
            deviceNeedsRefresh={deviceNeedsRefresh}
            device={selectedDevice}
            forceConnectionInfo={isConnectionShown}
            isDeviceDetailVisible={!isSidebarCollapsed}
        />
    );
};
