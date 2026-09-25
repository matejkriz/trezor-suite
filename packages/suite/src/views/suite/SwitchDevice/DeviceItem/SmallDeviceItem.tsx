import { Translation } from '@suite/intl';
import {
    isLedgerDevice,
    selectDeviceLabelOrNameById,
    selectSelectedDevice,
} from '@suite-common/device';
import { getDeviceInternalModel } from '@suite-common/suite-utils';
import { Icon, Image, Row } from '@trezor/components';
import { CableUsbCIcon, LinkBreakIcon, LinkIcon } from '@trezor/icons';

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

    const selectedDeviceModelInternal = getDeviceInternalModel(selectedDevice);

    return (
        <Row gap={8} padding={{ vertical: 8, horizontal: 8 }} alignItems="center">
            {isLedgerDevice(selectedDevice) ? (
                <Icon as={CableUsbCIcon} size={18} />
            ) : (
                <Image
                    width={18}
                    objectFit="contain"
                    alt="Trezor"
                    image={`TREZOR_${selectedDeviceModelInternal}`}
                />
            )}

            <DeviceDetail
                label={
                    forceAlternativeDeviceLabel ||
                    deviceLabel ||
                    (isLedgerDevice(selectedDevice) ? 'Ledger' : 'Trezor')
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
