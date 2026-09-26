import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { selectDeviceBrandName } from '@suite-common/device';
import { HStack, IconButton, Text } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { ScreenHeader, type ScreenHeaderProps } from '@suite-native/navigation';

import { ConfirmOnTrezorIndicator } from './ConfirmOnTrezorIndicator';

type ConfirmOnTrezorHeaderProps = ScreenHeaderProps & {
    onToggleSheet: () => void;
    isCloseButtonDisabled?: boolean;
};
export const ConfirmOnTrezorHeader = ({
    onToggleSheet,
    closeAction = undefined,
    closeActionType = 'back',
    isCloseButtonDisabled = false,
}: ConfirmOnTrezorHeaderProps) => {
    const deviceName = useSelector(selectDeviceBrandName);
    const backButtonProps = useMemo(
        () => (isCloseButtonDisabled ? { closeActionType: undefined, leftIcon: <></> } : {}),
        [isCloseButtonDisabled],
    );

    return (
        <ScreenHeader
            closeAction={closeAction}
            closeActionType={closeActionType}
            customContent={
                <HStack alignItems="center">
                    <Text variant="body-md-strong">
                        <Translation
                            id={
                                deviceName === 'Trezor'
                                    ? 'device.continueOnTrezor.headerTitle'
                                    : 'device.continueOnDevice.headerTitle'
                            }
                            values={{ deviceName }}
                        />
                    </Text>
                    <ConfirmOnTrezorIndicator />
                </HStack>
            }
            rightIcon={
                <IconButton
                    intent="neutral"
                    priority="secondary"
                    size="medium"
                    iconName="caretUpDown"
                    onPress={onToggleSheet}
                />
            }
            {...backButtonProps}
        />
    );
};
