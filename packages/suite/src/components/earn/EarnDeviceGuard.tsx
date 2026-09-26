import { type ReactNode } from 'react';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedDevice } from '@suite-common/device';
import {
    getWalletDeviceAccountCapabilities,
    injectWalletDeviceService,
    selectVisibleDeviceAccounts,
} from '@suite-common/wallet-core';
import { isStakingSymbol } from '@suite-common/wallet-utils';
import { Banner } from '@trezor/components';

import { useLayout, useSelector } from 'src/hooks/suite';

const EarnUnavailable = () => {
    useLayout('Earn');

    return (
        <Banner
            intent="info"
            icon
            title="Public account discovery only"
            description="Staking and yield are unavailable for this wallet. You can view your accounts and public addresses."
        />
    );
};

type EarnDeviceGuardProps = {
    children: ReactNode;
};

export const EarnDeviceGuard = ({ children }: EarnDeviceGuardProps) => {
    const { walletDeviceService } = useServices(injectWalletDeviceService);
    const device = useSelector(selectSelectedDevice);
    const accounts = useSelector(selectVisibleDeviceAccounts);
    const operations = device ? walletDeviceService.get(device) : undefined;
    const hasSigningAccount = accounts.some(
        account =>
            (isStakingSymbol(account.symbol) || account.networkType === 'ethereum') &&
            getWalletDeviceAccountCapabilities(operations, account).canSignTransaction,
    );

    if (operations?.getAccountCapabilities && !hasSigningAccount) {
        return <EarnUnavailable />;
    }

    return children;
};
