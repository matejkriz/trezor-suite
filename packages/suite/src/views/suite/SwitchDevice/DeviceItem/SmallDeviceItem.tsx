import { Translation } from '@suite/intl';
import {
    getDeviceBrandName,
    selectDeviceLabelOrNameById,
    selectSelectedDevice,
} from '@suite-common/device';
import { Row } from '@trezor/components';
import { LinkBreakIcon, LinkIcon } from '@trezor/icons';

import { DeviceImage } from 'src/components/suite/DeviceImage';
import { useSelector } from 'src/hooks/suite';

import { DeviceConnectionText } from './DeviceConnectionText';
import { DeviceDetail } from './DeviceDetail';

type SmallDeviceItemProps = {
    forceAlternativeDeviceLabel?: string;
};

export const SmallDeviceItem = ({ forceAlternativeDeviceLabel }: SmallDeviceItemProps) => {
    const selectedDevice = useSelector(selectSelectedDevice);
    const deviceLabel = useSelector(state =>
        selectDeviceLabelOrNameById(state, selectedDevice?.id),
    );

    const isConnected = selectedDevice?.connected ?? false;

    return (
        <Row gap={8} padding={{ vertical: 8, horizontal: 8 }} alignItems="center">
            <DeviceImage device={selectedDevice} size={18} />

            <DeviceDetail
                label={
                    forceAlternativeDeviceLabel || deviceLabel || getDeviceBrandName(selectedDevice)
                }
            >
                <DeviceConnectionText
                    icon={isConnected ? LinkIcon : LinkBreakIcon}
                    intent={isConnected ? 'brand' : 'critical'}
                >
                    <Translation id={isConnected ? 'TR_CONNECTED' : 'TR_DISCONNECTED'} />
                </DeviceConnectionText>
            </DeviceDetail>
        </Row>
    );
};
