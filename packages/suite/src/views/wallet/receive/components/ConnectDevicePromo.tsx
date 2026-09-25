import { type JSX } from 'react';

import { Translation } from '@suite/intl';
import { isLedgerDevice, selectSelectedDevice } from '@suite-common/device';
import { DEFAULT_FLAGSHIP_MODEL } from '@suite-common/suite-constants';
import { Banner } from '@trezor/components';
import { CableUsbCIcon } from '@trezor/icons';
import { mapTrezorModelToIcon } from '@trezor/product-components';

import { useSelector } from 'src/hooks/suite';

type ConnectDevicePromoProps = {
    title: JSX.Element | string;
    description: JSX.Element | string;
};

const ConnectDevicePromo = ({ title, description }: ConnectDevicePromoProps) => {
    const selectedDevice = useSelector(selectSelectedDevice);
    const selectedDeviceModelInternal =
        selectedDevice?.features?.internal_model || DEFAULT_FLAGSHIP_MODEL;

    return (
        <Banner
            intent="warning"
            data-testid="@warning/trezorNotConnected"
            icon={mapTrezorModelToIcon[selectedDeviceModelInternal]}
            title={title}
            description={description}
        />
    );
};

export const ConnectDeviceGenericPromo = () => {
    const device = useSelector(selectSelectedDevice);

    return isLedgerDevice(device) ? (
        <Banner
            intent="warning"
            icon={CableUsbCIcon}
            title="Connect Ledger"
            description="Connect and unlock your Ledger to continue."
        />
    ) : (
        <ConnectDevicePromo
            title={<Translation id="TR_CONNECT_DEVICE_GENERIC_PROMO_TITLE" />}
            description={<Translation id="TR_CONNECT_DEVICE_GENERIC_PROMO_DESCRIPTION" />}
        />
    );
};
