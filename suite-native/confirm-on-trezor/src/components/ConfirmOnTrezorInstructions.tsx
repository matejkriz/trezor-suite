import { useSelector } from 'react-redux';

import { selectDeviceBrandName } from '@suite-common/device';
import { Box, HardwareWalletSvg, Text, VStack } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

import { ConfirmOnTrezorAnimation } from './ConfirmOnTrezorAnimation';

const containerStyle = prepareNativeStyle(() => ({
    marginTop: '25%',
}));

export const ConfirmOnTrezorInstructions = () => {
    const { applyStyle } = useNativeStyles();
    const deviceName = useSelector(selectDeviceBrandName);

    return (
        <VStack flex={1} alignItems="center" spacing="sp20" style={applyStyle(containerStyle)}>
            {deviceName === 'Trezor' ? (
                <ConfirmOnTrezorAnimation />
            ) : (
                <HardwareWalletSvg width="100%" height={240} />
            )}
            <Box>
                <Text variant="headline-sm" textAlign="center">
                    <Translation
                        id={
                            deviceName === 'Trezor'
                                ? 'device.continueOnTrezor.title'
                                : 'device.continueOnDevice.title'
                        }
                        values={{ deviceName }}
                    />
                </Text>
                <Text variant="body-sm" textAlign="center">
                    <Translation id="device.continueOnTrezor.subtitle" />
                </Text>
            </Box>
        </VStack>
    );
};
