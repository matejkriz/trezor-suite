import React from 'react';

import { Translation } from '@suite/intl';
import { isLedgerDevice } from '@suite-common/device';
import { type TrezorDevice } from '@suite-common/suite-types';
import * as deviceUtils from '@suite-common/suite-utils';
import { LinkBreakIcon, LinkIcon, RepeatIcon } from '@trezor/icons';

import { getDeviceResolveStatusCTAMessage } from '../getDeviceResolveStatusCTAMessage';
import { DeviceConnectionText } from './DeviceConnectionText';
import { DeviceStatusTextThp } from './DeviceStatusTextThp';

type DeviceStatusTextProps = {
    device: TrezorDevice;
    forceConnectionInfo: boolean;
    deviceNeedsRefresh?: boolean;
};

export const DeviceStatusText = ({
    device,
    forceConnectionInfo,
    deviceNeedsRefresh,
}: DeviceStatusTextProps) => {
    if (isLedgerDevice(device)) {
        return (
            <DeviceConnectionText
                intent={device.connected ? 'brand' : 'neutral'}
                priority={device.connected ? 'primary' : 'secondary'}
                icon={device.connected ? LinkIcon : LinkBreakIcon}
                data-testid={
                    device.connected ? '@deviceStatus-connected' : '@deviceStatus-disconnected'
                }
                data-testid-alt="@deviceStatus"
            >
                <Translation id={device.connected ? 'TR_CONNECTED' : 'TR_DISCONNECTED'} />
            </DeviceConnectionText>
        );
    }

    const deviceStatus = deviceUtils.getStatus(device);
    if (deviceNeedsRefresh) {
        return (
            <DeviceConnectionText
                intent="warning"
                icon={RepeatIcon}
                data-testid="@deviceStatus-connected"
                data-testid-alt="@deviceStatus"
                isAction
            >
                <Translation id={getDeviceResolveStatusCTAMessage(deviceStatus)} />
            </DeviceConnectionText>
        );
    }

    return <DeviceStatusTextThp device={device} forceConnectionInfo={forceConnectionInfo} />;
};
