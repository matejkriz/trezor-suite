import { type ReactNode } from 'react';
import { Text } from 'react-native';

import { useRoute } from '@react-navigation/native';

import { deviceReducerInitialState } from '@suite-common/device';
import { mockAccountKey } from '@suite-common/wallet-types/mocks';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { act, renderWithStoreProvider } from '@suite-native/test-utils-store';

import { ReceiveAddressVerificationScreen } from './ReceiveAddressVerificationScreen';

const mockVerifyAddressOnDevice = jest.fn();
const mockUseFocusEffect = jest.fn();
const renderScreen = () =>
    renderWithStoreProvider(<ReceiveAddressVerificationScreen />, {
        preloadedState: { device: deviceReducerInitialState },
    });
let handleScreenFocus = () => {};

jest.mock('../hooks/useReceiveAddressVerification', () => ({
    useReceiveAddressVerification: () => ({
        verifyAddressOnDevice: mockVerifyAddressOnDevice,
    }),
}));

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (callback: () => void) => mockUseFocusEffect(callback),
    useRoute: jest.fn(),
}));

jest.mock('@suite-native/device', () => ({
    ...jest.requireActual('@suite-native/device'),
    ContinueOnTrezorScreenContent: ({ titleTxKey }: { titleTxKey: string }) => (
        <Text>{titleTxKey}</Text>
    ),
    DeviceInteractionScreenWrapper: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@suite-native/navigation', () => ({
    ...jest.requireActual('@suite-native/navigation'),
    useInterceptNativeNavigation: jest.fn(),
}));

describe('ReceiveAddressVerificationScreen', () => {
    const accountKey = mockAccountKey();
    const addressPath = "m/84'/0'/0'/0/0";
    const mockUseRoute = jest.mocked(useRoute);

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseFocusEffect.mockImplementation(callback => {
            handleScreenFocus = callback;
        });
        mockVerifyAddressOnDevice.mockResolvedValue(undefined);
        mockUseRoute.mockReturnValue({
            params: {
                accountKey,
                addressPath,
                source: ReceiveAddressVerificationSource.Pasted,
            },
        } as never);
    });

    it('displays pasted address verification instructions', async () => {
        const { getByText } = await renderScreen();

        expect(getByText('moduleReceive.addressVerificationScreen.pastedTitle')).toBeTruthy();
    });

    it('starts address verification only once when focused repeatedly', async () => {
        await renderScreen();

        await act(handleScreenFocus);
        await act(handleScreenFocus);

        expect(mockVerifyAddressOnDevice).toHaveBeenCalledTimes(1);
    });

    it('displays shared address verification instructions', async () => {
        mockUseRoute.mockReturnValue({
            params: {
                accountKey,
                addressPath,
                source: ReceiveAddressVerificationSource.Shared,
            },
        } as never);

        const { getByText } = await renderScreen();

        expect(getByText('moduleReceive.addressVerificationScreen.sharedTitle')).toBeTruthy();
    });
});
