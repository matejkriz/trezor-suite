import { useSelector } from 'react-redux';

import { useNavigation } from '@react-navigation/native';

import { selectDeviceSettingsCapabilities, selectIsDeviceInitialized } from '@suite-common/device';
import { selectHasRunningDiscovery } from '@suite-common/wallet-core';
import { HStack, IconButton, Text, VStack } from '@suite-native/atoms';
import { DeviceImage, selectDeviceImageKind } from '@suite-native/device';
import { useIsMultiline } from '@suite-native/helpers';
import { Translation } from '@suite-native/intl';
import {
    type DeviceSettingsStackParamList,
    DeviceSettingsStackRoutes,
    type StackNavigationProps,
} from '@suite-native/navigation';
import { type DeviceModelInternal } from '@trezor/device-utils';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

import { selectDeviceSettingsInformation } from '../selectors';

type DeviceInfoProps = {
    deviceModel: DeviceModelInternal;
    deviceName: string;
};

type NavigationProp = StackNavigationProps<
    DeviceSettingsStackParamList,
    DeviceSettingsStackRoutes.DeviceSettings
>;

const textStyle = prepareNativeStyle(_utils => ({
    lineHeight: undefined, // Reset line height to default, without this the text cannot align properly
    maxWidth: '90%',
}));

export const DeviceInfo = ({ deviceModel, deviceName }: DeviceInfoProps) => {
    const isDiscoveryRunning = useSelector(selectHasRunningDiscovery);
    const navigation = useNavigation<NavigationProp>();
    const { applyStyle } = useNativeStyles();
    const { onTextLayout, isMultiline } = useIsMultiline();
    const isDeviceInitialized = useSelector(selectIsDeviceInitialized);
    const capabilities = useSelector(selectDeviceSettingsCapabilities);
    const deviceImage = useSelector(selectDeviceImageKind);
    const information = useSelector(selectDeviceSettingsInformation);

    const navigateToDeviceNameStack = () => {
        navigation.navigate(DeviceSettingsStackRoutes.DeviceNameStack);
    };

    const name = isMultiline ? deviceName.replace(' ', '\n') : deviceName;

    return (
        <VStack marginTop="sp24" spacing="sp24" alignItems="center">
            <DeviceImage deviceModel={deviceModel} deviceImage={deviceImage} />
            <HStack alignItems="center" spacing="sp12">
                <Text style={applyStyle(textStyle)} variant="headline-md" onLayout={onTextLayout}>
                    {name}
                </Text>
                {isDeviceInitialized && capabilities.rename && (
                    <IconButton
                        onPress={navigateToDeviceNameStack}
                        isLoading={isDiscoveryRunning}
                        testID="@device-name/change-button"
                        iconName="pencilSimpleLine"
                        intent="neutral"
                        priority="secondary"
                    />
                )}
            </HStack>
            {information.length > 0 && (
                <VStack spacing="sp8" alignSelf="stretch">
                    {information.map(item => (
                        <HStack key={item.title} justifyContent="space-between" spacing="sp12">
                            <Text color="contentSecondary">
                                <Translation id={item.title} />
                            </Text>
                            <Text>{item.value}</Text>
                        </HStack>
                    ))}
                </VStack>
            )}
        </VStack>
    );
};
