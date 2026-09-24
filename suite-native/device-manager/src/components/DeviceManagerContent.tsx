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
import { AnimatedVStack, Button, VStack } from '@suite-native/atoms';
import { selectShouldFactoryResetBeVisible } from '@suite-native/device';
import {
    type AppTabsParamList,
    AppTabsRoutes,
    EarnStackRoutes,
    HomeStackRoutes,
    type TabNavigationProp,
    checkIsRouteAnyOf,
} from '@suite-native/navigation';
import { hasBitcoinOnlyFirmware } from '@trezor/device-utils';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

import { AddHiddenWalletButton } from './AddHiddenWalletButton';
import { ConnectButton } from './ConnectButton';
import { DeviceList } from './DeviceList';
import { DeviceManagerModal, MANAGER_MODAL_BOTTOM_RADIUS } from './DeviceManagerModal';
import { DeviceSettingsButton } from './DeviceSettingsButton';
import { DevicesToggleButton } from './DevicesToggleButton';
import { LedgerBitcoinBluetoothPanel } from './LedgerBitcoinBluetoothPanel';
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

type NavigationProp = TabNavigationProp<AppTabsParamList, AppTabsRoutes.HomeStack>;

export const DeviceManagerContent = () => {
    const { applyStyle, utils } = useNativeStyles();
    const [isChangeDeviceRequested, setIsChangeDeviceRequested] = useState(false);
    const [isLedgerMode, setIsLedgerMode] = useState(false);
    const { analytics, dispatch } = useServices(injectNativeAnalytics, injectDispatch);
    const isPortfolioTrackerDevice = useSelector(selectIsPortfolioTrackerDevice);
    const isPassphraseEnabledOnDevice = useSelector(selectIsDeviceProtectedByPassphrase);
    const shouldFactoryResetBeVisible = useSelector(selectShouldFactoryResetBeVisible);

    const hasRunningDiscovery = useSelector(selectHasRunningDiscovery);
    const isDeviceConnected = useSelector(selectIsDeviceConnected);
    const isDeviceInitialized = useSelector(selectIsDeviceInitialized);
    const deviceStaticSessionId = useSelector(selectDeviceStaticSessionId);

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

    return (
        <DeviceManagerModal
            footer={
                isLedgerMode ? (
                    <VStack paddingHorizontal="sp16" paddingBottom="sp16">
                        <Button
                            intent="neutral"
                            priority="secondary"
                            onPress={() => setIsLedgerMode(false)}
                        >
                            Back to Trezor devices
                        </Button>
                    </VStack>
                ) : (
                    <VStack spacing="sp12" paddingBottom="sp16">
                        <ConnectButton onSelectDevice={handleSelectDevice} />
                        <VStack paddingHorizontal="sp16">
                            <Button
                                intent="neutral"
                                priority="secondary"
                                isFullWidth
                                isDisabled={hasRunningDiscovery}
                                onPress={() => setIsLedgerMode(true)}
                            >
                                Connect Ledger Bitcoin via Bluetooth
                            </Button>
                        </VStack>
                    </VStack>
                )
            }
            customSwitchRightView={
                !isPortfolioTrackerDevice &&
                !isLedgerMode && (
                    <DevicesToggleButton
                        isOpened={isChangeDeviceRequested}
                        onDeviceButtonTap={toggleIsChangeDeviceRequested}
                    />
                )
            }
            onClose={() => {
                setIsChangeDeviceRequested(false);
                setIsLedgerMode(false);
            }}
        >
            <Animated.ScrollView
                style={applyStyle(scrollViewStyle, { maxHeight: scrollViewMaxHeight })}
                alwaysBounceVertical={false}
                showsVerticalScrollIndicator={false}
                layout={LinearTransition}
            >
                {isLedgerMode ? (
                    <LedgerBitcoinBluetoothPanel />
                ) : (
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
                                <VStack
                                    paddingHorizontal="sp16"
                                    paddingBottom="sp16"
                                    spacing="sp12"
                                >
                                    <DeviceSettingsButton />
                                    {isAddHiddenWalletButtonVisible && (
                                        <AddHiddenWalletButton isDisabled={hasRunningDiscovery} />
                                    )}
                                </VStack>
                            </AnimatedVStack>
                        )}
                    </VStack>
                )}
            </Animated.ScrollView>
        </DeviceManagerModal>
    );
};
