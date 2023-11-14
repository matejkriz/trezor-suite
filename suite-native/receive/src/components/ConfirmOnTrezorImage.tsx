import { Image, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import React, { useMemo, useState } from 'react';

import { prepareNativeStyle, useNativeStyles } from '@trezor/styles';

import { ConfirmOnTrezorBottomSheet } from './ConfirmOnTrezorBottomSheet';

const imageContainerStyle = prepareNativeStyle(utils => ({
    position: 'absolute',
    bottom: -utils.spacings.medium, // Hides a part of the image under bottom screen edge.
    width: '100%',
    alignItems: 'center',
}));

export const ConfirmOnTrezorImage = () => {
    const [isBottomSheetOpened, setIsBottomSheetOpened] = useState(false);
    const { applyStyle } = useNativeStyles();

    const imageSource = useMemo(() => require('../../assets/confirmOnTrezor.png'), []);

    const handleImagePress = () => {
        setIsBottomSheetOpened(true);
    };

    const handleCloseBottomSheet = () => {
        setIsBottomSheetOpened(false);
    };

    return (
        <>
            {/* TODO: images will be revisited in issue:
            https://github.com/trezor/trezor-suite/issues/9777 */}
            <Animated.View entering={FadeIn} style={applyStyle(imageContainerStyle)}>
                <Pressable onPress={handleImagePress}>
                    <Image source={imageSource} />
                </Pressable>
            </Animated.View>
            <ConfirmOnTrezorBottomSheet
                isOpened={isBottomSheetOpened}
                onClose={handleCloseBottomSheet}
            />
        </>
    );
};