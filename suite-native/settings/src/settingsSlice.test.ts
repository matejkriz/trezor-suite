import {
    type AppSettingsState,
    type ExperimentalFeature,
    appSettingsReducer,
    selectIsExperimentalFeatureEnabled,
    toggleExperimentalFeature,
} from './settingsSlice';

const getInitialState = () => appSettingsReducer(undefined, { type: 'undefined_action' });

const asRootState = (appSettings: AppSettingsState) => ({ appSettings });

describe('appSettingsSlice experimental features', () => {
    it('should have no experimental feature enabled initially', () => {
        const state = getInitialState();

        expect(state.experimentalFeatures).toEqual([]);
        expect(selectIsExperimentalFeatureEnabled(asRootState(state), 'slip24')).toBe(false);
        expect(selectIsExperimentalFeatureEnabled(asRootState(state), 'ledger')).toBe(false);
    });

    it.each<ExperimentalFeature>(['slip24', 'ledger'])('should enable and disable %s', feature => {
        const enabledState = appSettingsReducer(
            getInitialState(),
            toggleExperimentalFeature(feature),
        );

        expect(selectIsExperimentalFeatureEnabled(asRootState(enabledState), feature)).toBe(true);

        const disabledState = appSettingsReducer(enabledState, toggleExperimentalFeature(feature));

        expect(selectIsExperimentalFeatureEnabled(asRootState(disabledState), feature)).toBe(false);
    });

    it('should not affect other experimental features', () => {
        const state = appSettingsReducer(
            { ...getInitialState(), experimentalFeatures: ['suite-sync'] },
            toggleExperimentalFeature('slip24'),
        );

        expect(state.experimentalFeatures).toEqual(['suite-sync', 'slip24']);
    });
});
