import { getDeviceProvider } from '@suite-common/device';
import { DEFAULT_FLAGSHIP_MODEL } from '@suite-common/suite-constants';
import { type TrezorDevice } from '@suite-common/suite-types';
import { getDeviceInternalModel } from '@suite-common/suite-utils';
import { Icon, Image } from '@trezor/components';
import { getDeviceColorVariant } from '@trezor/device-utils';
import { CableUsbCIcon } from '@trezor/icons';
import { RotateDeviceImage, mapTrezorModelToIcon } from '@trezor/product-components';

export const getDeviceIcon = (device?: TrezorDevice) =>
    getDeviceProvider(device) === 'ledger'
        ? CableUsbCIcon
        : (mapTrezorModelToIcon[getDeviceInternalModel(device) ?? DEFAULT_FLAGSHIP_MODEL] ??
          mapTrezorModelToIcon[DEFAULT_FLAGSHIP_MODEL]);

type DeviceImageProps = {
    device?: TrezorDevice;
    size: number;
    isRotated?: boolean;
    iconSize?: number;
};

export const DeviceImage = ({
    device,
    size,
    isRotated = false,
    iconSize = size,
}: DeviceImageProps) => {
    const model = getDeviceInternalModel(device) ?? DEFAULT_FLAGSHIP_MODEL;

    if (getDeviceProvider(device) === 'ledger') return <Icon as={CableUsbCIcon} size={iconSize} />;

    return isRotated && device ? (
        <RotateDeviceImage
            deviceModel={model}
            deviceColor={getDeviceColorVariant(device)}
            height={size}
        />
    ) : (
        <Image width={size} objectFit="contain" alt="Trezor" image={`TREZOR_${model}`} />
    );
};
