import { type ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedDevice } from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { cancelDeviceActionThunk } from '@suite-common/wallet-core';
import { Screen, ScreenHeader } from '@suite-native/navigation';

type DeviceInteractionScreenWrapperProps = {
    children: ReactNode;
};

export const DeviceInteractionScreenWrapper = ({
    children,
}: DeviceInteractionScreenWrapperProps) => {
    const device = useSelector(selectSelectedDevice);
    const { dispatch } = useServices(injectDispatch);

    const closeAction = useCallback(() => {
        void dispatch(cancelDeviceActionThunk({ device }));
    }, [dispatch, device]);

    if (!device) {
        return null;
    }

    return (
        <Screen
            header={<ScreenHeader closeActionType="close" closeAction={closeAction} />}
            hasBottomInset={false}
            isScrollable={false}
        >
            {children}
        </Screen>
    );
};
