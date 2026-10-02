import {
    BackupFailed,
    BackupRecoverySeed,
    CreateWalletBackup,
    MultiShareBackup,
} from '@suite/backup';
import { setConnectionModal, useDevice } from '@suite/device';
import { Translation } from '@suite/intl';
import { ContextMessage } from '@suite/message-system';
import { isRecoveryInProgress } from '@suite/recovery';
import { useServices } from '@suite-common/dependency-injection';
import {
    getDeviceBrandName,
    getDeviceInformation,
    getDeviceOperationCapabilities,
    getDeviceSettingsCapabilities,
    selectIsDeviceAuthenticityCheckSupported,
} from '@suite-common/device';
import { Context } from '@suite-common/message-system';
import { injectDispatch } from '@suite-common/redux-utils';
import { getIsDeviceRemembered } from '@suite-common/suite-utils';
import { Banner, Text } from '@trezor/components';
import { isBitcoinOnlyDevice } from '@trezor/device-utils';
import {
    GhostIcon,
    NewspaperIcon,
    PaletteIcon,
    PasswordIcon,
    PlugsIcon,
    PuzzlePieceIcon,
    ShieldCheckIcon,
    ShieldWarningIcon,
    TrezorLogoIcon,
} from '@trezor/icons';
import { ActionColumn, SectionItem, SettingsSection, TextColumn } from '@trezor/product-components';
import { breakpoints } from '@trezor/theme';

import { DeviceBanner } from 'src/components/settings/DeviceBanner';
import { SettingsLayout } from 'src/components/settings/SettingsLayout';
import { useSelector } from 'src/hooks/suite';
import { selectHasActiveTransport } from 'src/selectors/suite/suiteSelectors';
import { useIsContentBelowBreakpoint } from 'src/support/suite/ContentFlex';
import type { TrezorDevice } from 'src/types/suite';
import { getHowToGetFromBootloaderInstructionsMap } from 'src/utils/device/bootloader';

import { AuthenticateDevice } from './AuthenticateDevice';
import { AutoLock } from './AutoLock';
import { Brightness } from './Brightness';
import { ChangeLanguage } from './ChangeLanguage';
import { ChangePin } from './ChangePin';
import { CheckRecoverySeed } from './CheckRecoverySeed';
import { CustomFirmware } from './CustomFirmware';
import { DeviceAuthenticityOptOut } from './DeviceAuthenticityOptOut';
import { DeviceLabel } from './DeviceLabel';
import { DisplayRotation } from './DisplayRotation';
import { FirmwareAuthenticityChecks } from './FirmwareAuthenticityChecks';
import { FirmwareTypeChange } from './FirmwareTypeChange';
import { FirmwareVersion } from './FirmwareVersion';
import { ForgetDevice } from './ForgetDevice';
import { HapticFeedback } from './HapticFeedback';
import { Homescreen } from './Homescreen';
import {
    NoDeviceEshopSettingsBanner,
    selectShouldShowNoDeviceEshopSettingsBanner,
} from './NoDeviceEshopSettingsBanner';
import { Passphrase } from './Passphrase';
import { PinProtection } from './PinProtection';
import { SafetyChecks } from './SafetyChecks';
import { ThpAutoconnect } from './ThpAutoconnect';
import { WipeCode } from './WipeCode';
import { WipeDevice } from './WipeDevice/WipeDevice';

const deviceSettingsUnavailable = (device?: TrezorDevice) => {
    const wrongDeviceType = device?.type && ['unacquired', 'unreadable'].includes(device.type);
    const wrongDeviceMode =
        (device?.mode && ['seedless'].includes(device.mode)) ||
        (device?.features !== undefined && isRecoveryInProgress(device?.features));
    const firmwareUpdateRequired = device?.firmware === 'required';

    return wrongDeviceType || wrongDeviceMode || firmwareUpdateRequired;
};

export const SettingsDevice = () => {
    const { dispatch } = useServices(injectDispatch);
    const hasContentBelowTabletWidth = useIsContentBelowBreakpoint(breakpoints.tablet);
    const hasContentBelowLaptopWidth = useIsContentBelowBreakpoint(breakpoints.laptop);
    const { device, isLocked } = useDevice();
    const hasActiveTransport = useSelector(selectHasActiveTransport);
    const capabilities = getDeviceSettingsCapabilities(device);
    const operations = getDeviceOperationCapabilities(device);
    const deviceInfo = getDeviceInformation(device);
    const noTransportAvailable = operations.trezorConnect && !hasActiveTransport;
    const deviceUnavailable = !device?.features;
    const isDeviceLocked = isLocked();
    const bootloaderMode = device?.mode === 'bootloader';
    const initializeMode = device?.mode === 'initialize';
    const isNormalMode = !bootloaderMode && !initializeMode;
    const deviceRemembered = getIsDeviceRemembered(device) && !device?.connected;
    const bitcoinOnlyDevice = isBitcoinOnlyDevice(device);
    const shouldShowNoDeviceEshopBanner = useSelector(selectShouldShowNoDeviceEshopSettingsBanner);
    const supportsDeviceAuthentication = useSelector(selectIsDeviceAuthenticityCheckSupported);
    if (noTransportAvailable || deviceSettingsUnavailable(device)) {
        return (
            <SettingsLayout>
                <DeviceBanner
                    title={<Translation id="TR_SETTINGS_DEVICE_BANNER_TITLE_UNAVAILABLE" />}
                    description={
                        <Translation id="TR_SETTINGS_DEVICE_BANNER_DESCRIPTION_UNAVAILABLE" />
                    }
                />
            </SettingsLayout>
        );
    }

    if (deviceUnavailable) {
        return (
            <SettingsLayout>
                <DeviceBanner
                    intent="info"
                    title={<Translation id="TR_SETTINGS_DEVICE_BANNER_TITLE_DISCONNECTED" />}
                    description={
                        <Translation id="TR_SETTINGS_DEVICE_BANNER_DESCRIPTION_DISCONNECTED" />
                    }
                    rightContent={
                        <Banner.Button onClick={() => dispatch(setConnectionModal(true))}>
                            <Translation id="TR_CONNECT" />
                        </Banner.Button>
                    }
                />
                {shouldShowNoDeviceEshopBanner && (
                    <SettingsSection
                        title={<Translation id="TR_TREZOR_WALLET" />}
                        hasContainer={false}
                        icon={TrezorLogoIcon}
                        hasVerticalLayout={hasContentBelowLaptopWidth}
                    >
                        <NoDeviceEshopSettingsBanner />
                    </SettingsSection>
                )}
            </SettingsLayout>
        );
    }

    const {
        unfinished_backup: unfinishedBackup,
        pin_protection: pinProtection,
        safety_checks: safetyChecks,
    } = device.features;

    const deviceModelInternal = device.features.internal_model;

    // because Device authenticity check is something you can (and have to) do on a device with FW but without seed
    const isSecuritySectionVisible =
        (isNormalMode &&
            (capabilities.pin || capabilities.safetyChecks || supportsDeviceAuthentication)) ||
        (initializeMode && supportsDeviceAuthentication);

    const isThpDevice = device?.thp !== undefined;

    const bootloaderDescription = getHowToGetFromBootloaderInstructionsMap({ deviceModelInternal });

    return (
        <SettingsLayout>
            <ContextMessage context={Context.getSettings('device')} />

            {(!capabilities.rename || deviceInfo) && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_DEVICE" />}
                    icon={PuzzlePieceIcon}
                >
                    {!capabilities.rename && (
                        <SectionItem data-testid="@settings/device/info/name">
                            <TextColumn
                                title={<Translation id="TR_DEVICE_SETTINGS_DEVICE_LABEL" />}
                            />
                            <ActionColumn>
                                <Text>
                                    {device.features.label ||
                                        device.name ||
                                        getDeviceBrandName(device)}
                                </Text>
                            </ActionColumn>
                        </SectionItem>
                    )}
                    {deviceInfo && (
                        <SectionItem data-testid="@settings/device/info/model">
                            <TextColumn title="Model" />
                            <ActionColumn>
                                <Text>{deviceInfo.model}</Text>
                            </ActionColumn>
                        </SectionItem>
                    )}
                    {device.connected && deviceInfo?.osVersion && (
                        <SectionItem data-testid="@settings/device/info/os-version">
                            <TextColumn title="OS version" />
                            <ActionColumn>
                                <Text>{deviceInfo.osVersion}</Text>
                            </ActionColumn>
                        </SectionItem>
                    )}
                    {device.connected && deviceInfo?.bitcoinAppVersion && (
                        <SectionItem data-testid="@settings/device/info/bitcoin-app-version">
                            <TextColumn title="Bitcoin app version" />
                            <ActionColumn>
                                <Text>{deviceInfo.bitcoinAppVersion}</Text>
                            </ActionColumn>
                        </SectionItem>
                    )}
                    {device.connected && deviceInfo?.batteryLevel !== undefined && (
                        <SectionItem data-testid="@settings/device/info/battery">
                            <TextColumn title="Battery" />
                            <ActionColumn>
                                <Text>{`${deviceInfo.batteryLevel}%`}</Text>
                            </ActionColumn>
                        </SectionItem>
                    )}
                </SettingsSection>
            )}

            {bootloaderMode && (
                <DeviceBanner
                    title={<Translation id="TR_SETTINGS_DEVICE_BANNER_TITLE_BOOTLOADER" />}
                    description={
                        bootloaderDescription !== null ? (
                            <Translation id={bootloaderDescription} />
                        ) : null
                    }
                />
            )}

            {deviceRemembered && (
                <DeviceBanner
                    title={<Translation id="TR_SETTINGS_DEVICE_BANNER_TITLE_REMEMBERED" />}
                />
            )}

            {isNormalMode && capabilities.backup && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_BACKUP" />}
                    icon={NewspaperIcon}
                >
                    {unfinishedBackup ? (
                        <BackupFailed />
                    ) : (
                        <>
                            <BackupRecoverySeed isDeviceLocked={isDeviceLocked} />
                            <MultiShareBackup isDeviceLocked={isDeviceLocked} />
                            <CheckRecoverySeed isDeviceLocked={isDeviceLocked} />
                            <CreateWalletBackup isDeviceLocked={isDeviceLocked} />
                        </>
                    )}
                </SettingsSection>
            )}

            {capabilities.passphrase && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_PASSPHRASE" />}
                    icon={PasswordIcon}
                >
                    <Passphrase isDeviceLocked={isDeviceLocked} />
                </SettingsSection>
            )}

            {(capabilities.firmwareUpdate || capabilities.language) && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_FIRMWARE" />}
                    icon={PuzzlePieceIcon}
                >
                    {capabilities.firmwareUpdate && (
                        <FirmwareVersion isDeviceLocked={isDeviceLocked} />
                    )}
                    {capabilities.firmwareUpdate && (!bootloaderMode || bitcoinOnlyDevice) && (
                        <FirmwareTypeChange isDeviceLocked={isDeviceLocked} />
                    )}
                    {capabilities.language && <ChangeLanguage isDeviceLocked={isDeviceLocked} />}
                </SettingsSection>
            )}

            {isSecuritySectionVisible && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_DEVICE_SECURITY" />}
                    icon={ShieldCheckIcon}
                >
                    {isNormalMode && (
                        <>
                            {capabilities.pin && <PinProtection isDeviceLocked={isDeviceLocked} />}
                            {capabilities.pin && pinProtection && (
                                <ChangePin isDeviceLocked={isDeviceLocked} />
                            )}
                            {capabilities.safetyChecks && safetyChecks && (
                                <SafetyChecks isDeviceLocked={isDeviceLocked} />
                            )}
                        </>
                    )}
                    {supportsDeviceAuthentication && (
                        <AuthenticateDevice isDeviceLocked={isDeviceLocked} />
                    )}
                </SettingsSection>
            )}

            {isNormalMode &&
                (capabilities.rename ||
                    capabilities.homescreen ||
                    capabilities.displayRotation ||
                    capabilities.brightness ||
                    capabilities.hapticFeedback ||
                    (capabilities.autoLock && pinProtection)) && (
                    <SettingsSection
                        hasVerticalLayout={hasContentBelowTabletWidth}
                        title={<Translation id="TR_PERSONALIZATION" />}
                        icon={PaletteIcon}
                    >
                        {capabilities.rename && <DeviceLabel isDeviceLocked={isDeviceLocked} />}
                        {capabilities.homescreen && <Homescreen isDeviceLocked={isDeviceLocked} />}
                        {capabilities.displayRotation && (
                            <DisplayRotation isDeviceLocked={isDeviceLocked} />
                        )}
                        {capabilities.brightness && <Brightness isDeviceLocked={isDeviceLocked} />}
                        {capabilities.hapticFeedback && (
                            <HapticFeedback isDeviceLocked={isDeviceLocked} />
                        )}
                        {capabilities.autoLock && pinProtection && (
                            <AutoLock isDeviceLocked={isDeviceLocked} />
                        )}
                    </SettingsSection>
                )}

            <SettingsSection
                hasVerticalLayout={hasContentBelowTabletWidth}
                title={<Translation id="TR_DEVICE_CONNECTION" />}
                icon={PlugsIcon}
            >
                {isThpDevice && <ThpAutoconnect isDeviceLocked={isDeviceLocked} />}
                <ForgetDevice />
            </SettingsSection>

            {(supportsDeviceAuthentication || operations.firmwareChecks) && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_SETTINGS_ADVANCED" />}
                    icon={ShieldWarningIcon}
                >
                    <DeviceAuthenticityOptOut
                        isDeviceAuthenticityCheckSupported={supportsDeviceAuthentication}
                    />
                    {operations.firmwareChecks && <FirmwareAuthenticityChecks />}
                </SettingsSection>
            )}

            {(capabilities.wipe || capabilities.wipeCode || capabilities.firmwareUpdate) && (
                <SettingsSection
                    hasVerticalLayout={hasContentBelowTabletWidth}
                    title={<Translation id="TR_ADVANCED" />}
                    icon={GhostIcon}
                >
                    {capabilities.wipe && <WipeDevice isDeviceLocked={isDeviceLocked} />}
                    {isNormalMode && capabilities.wipeCode && (
                        <WipeCode isDeviceLocked={isDeviceLocked} />
                    )}
                    {capabilities.firmwareUpdate && <CustomFirmware />}
                </SettingsSection>
            )}
        </SettingsLayout>
    );
};
