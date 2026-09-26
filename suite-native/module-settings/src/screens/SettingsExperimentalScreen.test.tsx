import { mock } from '@suite-common/dependency-injection';
import { type NativeAnalyticsDep } from '@suite-native/analytics';
import { mockNativeAnalytics } from '@suite-native/analytics/mocks';
import { type EXPERIMENTAL_FEATURES } from '@suite-native/experimental-features';
import { getTranslation } from '@suite-native/intl';
import { SettingsStackRoutes } from '@suite-native/navigation';
import { appSettingsReducer, selectIsExperimentalFeatureEnabled } from '@suite-native/settings';
import {
    createLightStore,
    createStaticReducer,
    createStoreFromPreloadedState,
    fireEvent,
    renderWithStoreProvider,
} from '@suite-native/test-utils-store';

import { SettingsExperimentalScreen } from './SettingsExperimentalScreen';

let mockExperimentalFeatures: typeof EXPERIMENTAL_FEATURES;

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useRoute: () => ({
        name: SettingsStackRoutes.SettingsExperimental,
        key: SettingsStackRoutes.SettingsExperimental,
        params: {},
    }),
}));

jest.mock('@suite-native/experimental-features', () => ({
    ...jest.requireActual('@suite-native/experimental-features'),
    get EXPERIMENTAL_FEATURES() {
        return mockExperimentalFeatures;
    },
}));

const preloadedState = {
    appSettings: { experimentalFeatures: [] },
    messageSystem: {
        config: null,
        validMessages: { banner: [], context: [], modal: [], feature: [] },
        dismissedMessages: {},
    },
};

describe('SettingsExperimentalScreen', () => {
    const renderSettingsExperimentalScreen = async () =>
        await renderWithStoreProvider(<SettingsExperimentalScreen />, { preloadedState });

    beforeEach(() => {
        mockExperimentalFeatures = jest.requireActual(
            '@suite-native/experimental-features',
        ).EXPERIMENTAL_FEATURES;
    });

    it('offers Ledger support disabled by default and lets the user enable and disable it', async () => {
        const baseState = createStoreFromPreloadedState(preloadedState).getState();
        const store = createLightStore({
            reducer: {
                appSettings: appSettingsReducer,
                messageSystem: createStaticReducer(baseState.messageSystem),
                wallet: createStaticReducer(baseState.wallet),
                locale: createStaticReducer(baseState.locale),
                discreetMode: createStaticReducer(baseState.discreetMode),
            },
        });
        const services: NativeAnalyticsDep = { analytics: mockNativeAnalytics(mock()) };
        const { getByRole, getByText } = await renderWithStoreProvider(
            <SettingsExperimentalScreen />,
            { services: { ...services, store } },
        );

        expect(
            getByText(getTranslation('moduleSettings.experimental.ledger.title')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleSettings.experimental.ledger.description')),
        ).toBeOnTheScreen();

        const getLedgerSwitch = () => getByRole('switch', { name: 'ledger toggle' });
        expect(getLedgerSwitch()).not.toBeChecked();
        await fireEvent.press(getLedgerSwitch());
        expect(getLedgerSwitch()).toBeChecked();
        expect(selectIsExperimentalFeatureEnabled(store.getState(), 'ledger')).toBe(true);

        await fireEvent.press(getLedgerSwitch());
        expect(getLedgerSwitch()).not.toBeChecked();
        expect(selectIsExperimentalFeatureEnabled(store.getState(), 'ledger')).toBe(false);
    });

    it('should render a row for every configured experimental feature', async () => {
        const { getByText, queryByText } = await renderSettingsExperimentalScreen();

        expect(
            getByText(getTranslation('moduleSettings.experimental.slip24.title')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleSettings.experimental.slip24.description')),
        ).toBeOnTheScreen();
        expect(
            queryByText(getTranslation('moduleSettings.experimental.noneAvailable.title')),
        ).toBeNull();
    });

    it('should render the empty state when no experimental feature is configured', async () => {
        mockExperimentalFeatures = {};

        const { getByText, queryByText } = await renderSettingsExperimentalScreen();

        expect(
            getByText(getTranslation('moduleSettings.experimental.noneAvailable.title')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleSettings.experimental.noneAvailable.subtitle')),
        ).toBeOnTheScreen();
        expect(queryByText(getTranslation('moduleSettings.experimental.slip24.title'))).toBeNull();
    });
});
