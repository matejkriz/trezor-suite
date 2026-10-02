import { Translation } from '@suite/intl';
import { selectDeviceBrandName, selectSelectedDevice } from '@suite-common/device';
import { Banner } from '@trezor/components';

import { getDeviceIcon } from 'src/components/suite/DeviceImage';
import { useSelector } from 'src/hooks/suite';

export const ConnectDeviceGenericPromo = () => {
    const device = useSelector(selectSelectedDevice);
    const deviceBrand = useSelector(selectDeviceBrandName);

    return (
        <Banner
            intent="warning"
            data-testid="@warning/trezorNotConnected"
            icon={getDeviceIcon(device)}
            title={<Translation id="TR_DEVICE_DISCONNECTED" values={{ deviceBrand }} />}
            description={
                <Translation id="TR_CONNECT_DEVICE_TO_CONTINUE" values={{ deviceBrand }} />
            }
        />
    );
};
