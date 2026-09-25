import { selectSelectedDevice, selectSelectedExternalWallet } from '@suite-common/device';

import { useSelector } from 'src/hooks/suite';

export const useIsTradingWalletConnected = () => {
    const device = useSelector(selectSelectedDevice);
    const externalWallet = useSelector(selectSelectedExternalWallet);

    return externalWallet?.connected ?? device?.connected ?? false;
};
