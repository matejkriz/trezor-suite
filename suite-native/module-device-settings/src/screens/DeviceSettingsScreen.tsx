import { useSelector } from 'react-redux';

import {
    selectDeviceLabel,
    selectDeviceModel,
    selectDeviceName,
    selectDeviceSettingsCapabilities,
    selectIsDeviceInitialized,
} from '@suite-common/device';
import { TitledSection, VStack } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { Screen, ScreenHeader, useNavigateToInitialScreen } from '@suite-native/navigation';

import { BackupAndPassphraseCard } from '../components/BackupAndPassphraseCard';
import { DeviceAuthenticityCard } from '../components/DeviceAuthenticityCard';
import { DeviceConnectionCard } from '../components/DeviceConnectionCard';
import { DeviceFirmwareCard } from '../components/DeviceFirmwareCard';
import { DeviceInfo } from '../components/DeviceInfo';
import { DevicePinProtectionCard } from '../components/DevicePinProtectionCard';
import { WipeDeviceCard } from '../components/WipeDeviceCard';
import { useDeviceChangedCheck } from '../hooks/useDeviceChangedCheck';

export const DeviceSettingsScreen = () => {
    useDeviceChangedCheck();

    const navigateToInitialScreen = useNavigateToInitialScreen();

    const deviceModel = useSelector(selectDeviceModel);
    const deviceName = useSelector(selectDeviceName);
    const deviceLabel = useSelector(selectDeviceLabel);
    const isDeviceInitialized = useSelector(selectIsDeviceInitialized);
    const capabilities = useSelector(selectDeviceSettingsCapabilities);
    const hasSecuritySettings =
        (isDeviceInitialized &&
            (capabilities.pin || capabilities.backup || capabilities.passphrase)) ||
        capabilities.authenticity;

    if (!deviceModel || !deviceName) {
        return null;
    }

    return (
        <Screen
            header={<ScreenHeader closeActionType="close" closeAction={navigateToInitialScreen} />}
        >
            <VStack spacing="sp40">
                <DeviceInfo deviceName={deviceLabel || deviceName} deviceModel={deviceModel} />
                <TitledSection
                    title={<Translation id="moduleDeviceSettings.sectionTitles.general" />}
                >
                    {capabilities.firmwareUpdate && <DeviceFirmwareCard />}
                    <DeviceConnectionCard />
                </TitledSection>
                {hasSecuritySettings && (
                    <TitledSection
                        title={<Translation id="moduleDeviceSettings.sectionTitles.security" />}
                    >
                        {isDeviceInitialized && capabilities.pin && <DevicePinProtectionCard />}
                        {isDeviceInitialized &&
                            (capabilities.backup || capabilities.passphrase) && (
                                <BackupAndPassphraseCard />
                            )}
                        {capabilities.authenticity && <DeviceAuthenticityCard />}
                    </TitledSection>
                )}
                {capabilities.wipe && (
                    <TitledSection
                        title={<Translation id="moduleDeviceSettings.sectionTitles.dangerZone" />}
                    >
                        <WipeDeviceCard />
                    </TitledSection>
                )}
            </VStack>
        </Screen>
    );
};
