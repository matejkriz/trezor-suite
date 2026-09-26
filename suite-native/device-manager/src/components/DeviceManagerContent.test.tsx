import { type ReactNode } from 'react';

import { getTranslation } from '@suite-native/intl';
import { HomeStackRoutes, RootStackRoutes } from '@suite-native/navigation';
import { type ExperimentalFeature } from '@suite-native/settings';
import { fireEvent, renderWithStoreProvider } from '@suite-native/test-utils-store';

import { DeviceManagerContent } from './DeviceManagerContent';

const mockNavigate = jest.fn();
const mockSetIsDeviceManagerVisible = jest.fn();

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate }),
    useRoute: () => ({ name: HomeStackRoutes.Home }),
}));

jest.mock('../hooks/useDeviceManager', () => ({
    useDeviceManager: () => ({ setIsDeviceManagerVisible: mockSetIsDeviceManagerVisible }),
}));

type MockDeviceManagerModalProps = { footer: ReactNode };

jest.mock('./DeviceManagerModal', () => ({
    MANAGER_MODAL_BOTTOM_RADIUS: 12,
    DeviceManagerModal: ({ footer }: MockDeviceManagerModalProps) => footer,
}));

jest.mock('./ConnectButton', () => ({ ConnectButton: () => null }));
jest.mock('./DeviceList', () => ({ DeviceList: () => null }));
jest.mock('./WalletList', () => ({ WalletList: () => null }));
jest.mock('./DeviceSettingsButton', () => ({ DeviceSettingsButton: () => null }));
jest.mock('./DevicesToggleButton', () => ({ DevicesToggleButton: () => null }));
jest.mock('./AddHiddenWalletButton', () => ({ AddHiddenWalletButton: () => null }));

const renderDeviceManagerContent = (experimentalFeatures: ExperimentalFeature[] = []) =>
    renderWithStoreProvider(<DeviceManagerContent />, {
        preloadedState: {
            device: { devices: [], selectedDevice: undefined },
            appSettings: { experimentalFeatures },
        },
    });

describe('DeviceManagerContent Ledger connection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each<{ experimentalFeatures: ExperimentalFeature[] }>([
        { experimentalFeatures: [] },
        { experimentalFeatures: ['slip24'] },
    ])(
        'hides Connect Ledger without its experimental flag (%j)',
        async ({ experimentalFeatures }) => {
            const { queryByText } = await renderDeviceManagerContent(experimentalFeatures);

            expect(queryByText(getTranslation('moduleConnectLedger.button'))).toBeNull();
        },
    );

    it('opens the connection screen when Ledger support is enabled', async () => {
        const { getByText } = await renderDeviceManagerContent(['ledger']);

        await fireEvent.press(getByText(getTranslation('moduleConnectLedger.button')));

        expect(mockSetIsDeviceManagerVisible).toHaveBeenCalledWith(false);
        expect(mockNavigate).toHaveBeenCalledWith(RootStackRoutes.ConnectLedger);
    });
});
