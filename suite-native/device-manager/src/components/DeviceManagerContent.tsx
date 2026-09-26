import { useState } from 'react';
import { Dimensions } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { useNavigation, useRoute } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import {
    PORTFOLIO_TRACKER_DEVICE_ID,
    selectDeviceStaticSessionId,
    selectDeviceThunk,
    selectIsDeviceConnected,
    selectIsDeviceInitialized,
    selectIsDeviceProtectedByPassphrase,
    selectIsPortfolioTrackerDevice,
} from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { type TrezorDevice } from '@suite-common/suite-types';
import { selectHasRunningDiscovery } from '@suite-common/wallet-core';
import { events, injectNativeAnalytics } from '@suite-native/analytics';
import { AnimatedVStack, Box, Button, VStack } from '@suite-native/atoms';
import { selectShouldFactoryResetBeVisible } from '@suite-native/device';
import { Translation } from '@suite-native/intl';
import {
    type AppTabsParamList,
    AppTabsRoutes,
    EarnStackRoutes,
    HomeStackRoutes,
    type RootStackParamList,
    RootStackRoutes,
    type TabToStackCompositeNavigationProp,
    checkIsRouteAnyOf,
} from '@suite-native/navigation';
import {
    type SettingsSliceRootState,
    selectIsExperimentalFeatureEnabled,
} from '@suite-native/settings';
import { hasBitcoinOnlyFirmware } from '@trezor/device-utils';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

import { AddHiddenWalletButton } from './AddHiddenWalletButton';
import { ConnectButton } from './ConnectButton';
import { DeviceList } from './DeviceList';
import { DeviceManagerModal, MANAGER_MODAL_BOTTOM_RADIUS } from './DeviceManagerModal';
import { DeviceSettingsButton } from './DeviceSettingsButton';
import { DevicesToggleButton } from './DevicesToggleButton';
import { WalletList } from './WalletList';
import { useDeviceManager } from '../hooks/useDeviceManager';

const CONTENT_MAX_HEIGHT = Dimensions.get('window').height * 0.8;
const HEADER_HEIGHT = 86;

const scrollViewStyle = prepareNativeStyle<{ maxHeight: number }>((utils, { maxHeight }) => ({
    gap: utils.spacings.sp12,
    flexGrow: 0,
    maxHeight,
    borderBottomLeftRadius: MANAGER_MODAL_BOTTOM_RADIUS,
    borderBottomRightRadius: MANAGER_MODAL_BOTTOM_RADIUS,
}));

const footerButtonSurfaceStyle = prepareNativeStyle(utils => ({
    backgroundColor: utils.colors.surfaceFillRaised,
    borderRadius: utils.borders.radii.r12,
}));

type NavigationProp = TabToStackCompositeNavigationProp<
    AppTabsParamList,
    AppTabsRoutes.HomeStack,
    RootStackParamList
>;

export const DeviceManagerContent = () => {
    const { applyStyle, utils } = useNativeStyles();
    const [isChangeDeviceRequested, setIsChangeDeviceRequested] = useState(false);
    const { analytics, dispatch } = useServices(injectNativeAnalytics, injectDispatch);
    const isPortfolioTrackerDevice = useSelector(selectIsPortfolioTrackerDevice);
    const isPassphraseEnabledOnDevice = useSelector(selectIsDeviceProtectedByPassphrase);
    const shouldFactoryResetBeVisible = useSelector(selectShouldFactoryResetBeVisible);

    const hasRunningDiscovery = useSelector(selectHasRunningDiscovery);
    const isDeviceConnected = useSelector(selectIsDeviceConnected);
    const isDeviceInitialized = useSelector(selectIsDeviceInitialized);
    const deviceStaticSessionId = useSelector(selectDeviceStaticSessionId);
    const isLedgerEnabled = useSelector((state: SettingsSliceRootState) =>
        selectIsExperimentalFeatureEnabled(state, 'ledger'),
    );

    const navigation = useNavigation<NavigationProp>();
    const currentRoute = useRoute();

    const { setIsDeviceManagerVisible } = useDeviceManager();

    const toggleIsChangeDeviceRequested = () =>
        setIsChangeDeviceRequested(!isChangeDeviceRequested);
    const insets = useSafeAreaInsets();

    const handleSelectDevice = (selectedDevice: TrezorDevice) => {
        const isOnEarnScreenRoute = checkIsRouteAnyOf([EarnStackRoutes.Earn], currentRoute.name);
        const isBitcoinOnlyFirmware = hasBitcoinOnlyFirmware(selectedDevice);

        // When user selects BTC only device in device switcher, redirect to homescreen out of the earn section.
        if (isOnEarnScreenRoute && isBitcoinOnlyFirmware) {
            navigation.navigate(AppTabsRoutes.HomeStack, { screen: HomeStackRoutes.Home });
        }

        dispatch(selectDeviceThunk({ device: selectedDevice }));
        setIsChangeDeviceRequested(false);
        setIsDeviceManagerVisible(false);

        analytics.report({
            type: events.switcherEvent.name,
            payload: {
                action:
                    selectedDevice.id === PORTFOLIO_TRACKER_DEVICE_ID
                        ? 'portfolioTracker'
                        : 'connectDeviceButton',
            },
        });
    };

    // based on DeviceManagerModal header height and top offset
    const scrollViewTopOffset = insets.top + utils.spacings.sp24 + HEADER_HEIGHT;
    const scrollViewMaxHeight = CONTENT_MAX_HEIGHT - scrollViewTopOffset;

    // Kept visible (but disabled) while discovery runs so the button doesn't vanish mid-discovery,
    // mirroring the desktop switch-device behavior.
    const isAddHiddenWalletButtonVisible =
        isDeviceConnected &&
        isDeviceInitialized &&
        deviceStaticSessionId &&
        isPassphraseEnabledOnDevice;

    const isDeviceListVisible = isChangeDeviceRequested || isPortfolioTrackerDevice;

    const handleConnectLedger = () => {
        setIsDeviceManagerVisible(false);
        navigation.navigate(RootStackRoutes.ConnectLedger);
    };

    return (
        <DeviceManagerModal
            footer={
                <VStack spacing="sp12" paddingBottom="sp16">
                    <ConnectButton onSelectDevice={handleSelectDevice} />
                    {isLedgerEnabled && (
                        <VStack paddingHorizontal="sp16">
                            <Box style={applyStyle(footerButtonSurfaceStyle)}>
                                <Button
                                    intent="neutral"
                                    priority="secondary"
                                    isFullWidth
                                    isDisabled={hasRunningDiscovery}
                                    onPress={handleConnectLedger}
                                >
                                    <Translation id="moduleConnectLedger.button" />
                                </Button>
                            </Box>
                        </VStack>
                    )}
                </VStack>
            }
            customSwitchRightView={
                !isPortfolioTrackerDevice && (
                    <DevicesToggleButton
                        isOpened={isChangeDeviceRequested}
                        onDeviceButtonTap={toggleIsChangeDeviceRequested}
                    />
                )
            }
            onClose={() => {
                setIsChangeDeviceRequested(false);
            }}
        >
            <Animated.ScrollView
                style={applyStyle(scrollViewStyle, { maxHeight: scrollViewMaxHeight })}
                alwaysBounceVertical={false}
                showsVerticalScrollIndicator={false}
                layout={LinearTransition}
            >
                <VStack spacing="sp24">
                    {isDeviceListVisible && <DeviceList onSelectDevice={handleSelectDevice} />}
                    {!isPortfolioTrackerDevice && !shouldFactoryResetBeVisible && (
                        <AnimatedVStack
                            layout={LinearTransition}
                            marginTop={!isDeviceListVisible ? 'sp12' : undefined}
                        >
                            {deviceStaticSessionId && (
                                <WalletList onSelectDevice={handleSelectDevice} />
                            )}
                            <VStack paddingHorizontal="sp16" paddingBottom="sp16" spacing="sp12">
                                <DeviceSettingsButton />
                                {isAddHiddenWalletButtonVisible && (
                                    <AddHiddenWalletButton isDisabled={hasRunningDiscovery} />
                                )}
                            </VStack>
                        </AnimatedVStack>
                    )}
                </VStack>
            </Animated.ScrollView>
        </DeviceManagerModal>
    );
};
