import { useSelector } from 'react-redux';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedDevice } from '@suite-common/device';
import { type Account } from '@suite-common/wallet-types';

import { injectWalletDeviceService } from './createWalletDeviceService';
import { getWalletDeviceAccountCapabilities } from './walletDeviceAccountCapabilities';

export const useWalletDeviceAccountCapabilities = (account: Account | null | undefined) => {
    const { walletDeviceService } = useServices(injectWalletDeviceService);
    const device = useSelector(selectSelectedDevice);

    return getWalletDeviceAccountCapabilities(
        device ? walletDeviceService.get(device) : undefined,
        account,
    );
};
