import { useSelector } from 'react-redux';

import { selectDeviceModelWithFlagshipFallback } from '@suite-common/device';
import { Box, Text, VStack } from '@suite-native/atoms';
import { Translation, type TxKeyPath } from '@suite-native/intl';
import { getScreenHeight } from '@trezor/env-utils';

import { DeviceImage } from './DeviceImage';
import { selectDeviceImageKind } from '../selectors';

const SCREEN_HEIGHT = getScreenHeight();

type FollowDeviceScreenContentProps = {
    titleTxKey: TxKeyPath;
    isTxSigned?: boolean;
};

export const FollowDeviceScreenContent = ({
    titleTxKey,
    isTxSigned = false,
}: FollowDeviceScreenContentProps) => {
    const deviceModel = useSelector(selectDeviceModelWithFlagshipFallback);
    const deviceImage = useSelector(selectDeviceImageKind);

    return (
        <VStack flex={1} spacing="sp24" paddingBottom="sp24" testID="@follow-device">
            <Box flex={1} alignItems="center" justifyContent="center">
                <DeviceImage
                    deviceModel={deviceModel}
                    deviceImage={deviceImage}
                    size="large"
                    maxHeight={0.42 * SCREEN_HEIGHT}
                />
            </Box>

            {!isTxSigned && (
                <Text variant="headline-md" textAlign="center">
                    <Translation id={titleTxKey} />
                </Text>
            )}
        </VStack>
    );
};
