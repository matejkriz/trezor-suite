import { useNavigation } from '@react-navigation/native';

import { ConnectLedgerDeviceScreenContent } from '@suite-native/device';
import {
    type RootStackParamList,
    type RootStackRoutes,
    Screen,
    ScreenHeader,
    type StackNavigationProps,
    useInterceptNativeNavigation,
} from '@suite-native/navigation';

export const ConnectLedgerScreen = () => {
    const navigation =
        useNavigation<StackNavigationProps<RootStackParamList, RootStackRoutes.ConnectLedger>>();
    const handleClose = () => navigation.goBack();
    useInterceptNativeNavigation({ onPress: handleClose });

    return (
        <Screen
            header={<ScreenHeader closeAction={handleClose} closeActionType="close" />}
            isScrollable
        >
            <ConnectLedgerDeviceScreenContent onConnected={handleClose} />
        </Screen>
    );
};
