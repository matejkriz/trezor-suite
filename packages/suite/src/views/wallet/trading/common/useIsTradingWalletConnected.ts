import { selectSelectedDevice } from '@suite-common/device';

import { useSelector } from 'src/hooks/suite';

export const useIsTradingWalletConnected = () => {
    const device = useSelector(selectSelectedDevice);

    return device?.connected ?? false;
};
