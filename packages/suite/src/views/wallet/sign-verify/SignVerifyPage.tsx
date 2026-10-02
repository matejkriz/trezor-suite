import { useEffect } from 'react';

import { selectFullSelectedAccount } from '@suite/account';
import { gotoThunk } from '@suite/router';
import { SignVerify } from '@suite/sign-verify';
import { useServices } from '@suite-common/dependency-injection';
import { getDeviceOperationCapabilities, selectSelectedDevice } from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';

import { WalletLayout, WalletSubpageHeading } from 'src/components/wallet';
import { useSelector } from 'src/hooks/suite';
import { ConnectDeviceGenericPromo } from 'src/views/wallet/receive/components/ConnectDevicePromo';

export const SignVerifyPage = () => {
    const selectedAccount = useSelector(selectFullSelectedAccount);
    const selectedDevice = useSelector(selectSelectedDevice);
    const { dispatch } = useServices(injectDispatch);
    const { account } = selectedAccount;

    useEffect(() => {
        if (!getDeviceOperationCapabilities(selectedDevice).messageSigning) {
            dispatch(gotoThunk({ routeName: 'wallet-index', preserveParams: true }));
        }
    }, [dispatch, selectedDevice]);

    if (account === undefined) {
        return null;
    }

    if (!getDeviceOperationCapabilities(selectedDevice).messageSigning) {
        return <WalletLayout title="TR_NAV_SIGN_VERIFY" account={selectedAccount} />;
    }

    return (
        <SignVerify
            account={account}
            network={selectedAccount.network}
            renderShell={({ title, isDeviceConnected, children }) => (
                <WalletLayout title={title} isSubpage account={selectedAccount}>
                    <WalletSubpageHeading title={title} />

                    {!isDeviceConnected && <ConnectDeviceGenericPromo />}

                    {children}
                </WalletLayout>
            )}
        />
    );
};
