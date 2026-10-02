import '@suite-common/test-utils/globalOverrides';

import { fireEvent, waitFor } from '@testing-library/react';

import { type DesktopAnalyticsDep } from '@suite/analytics';
import { mockDesktopAnalytics } from '@suite/analytics/mocks';
import { openConnectionModal } from '@suite/device';
import { type ExperimentalFeature } from '@suite/experimental';
import { prepareSuiteSettingsReducer, selectHasExperimentalFeature } from '@suite/settings';
import { mock } from '@suite-common/dependency-injection';
import { mockActionType, mockReducer } from '@suite-common/redux-utils/mocks';
import { createTestCompositionRoot, screen } from '@suite-common/test-utils';

import { DeviceConnect } from 'src/components/suite/PrerequisitesGuide/DeviceConnect';
import { NoTransport } from 'src/components/suite/PrerequisitesGuide/NoTransport';
import { type SuiteServices } from 'src/support/createSuiteCompositionRoot';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';
import { type ForegroundAppProps } from 'src/types/suite';
import { Experimental } from 'src/views/settings/SettingsGeneral/Experimental';
import { SwitchDeviceContent } from 'src/views/suite/SwitchDevice/SwitchDevice';

import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

jest.mock('@trezor/env-utils', () => ({
    ...jest.requireActual('@trezor/env-utils'),
    isDesktop: () => false,
}));

jest.mock('src/support/createSuiteCompositionRoot', () => ({
    selectSuiteServices: (services: SuiteServices) => services,
}));

describe.each([
    [
        'device switcher',
        <SwitchDeviceContent
            key="switcher"
            cancelable
            onCancel={mock<ForegroundAppProps['onCancel']>()}
        />,
    ],
    ['connection prompt', <DeviceConnect key="connect" />],
    ['unavailable Trezor transport', <NoTransport key="transport" />],
])('Ledger connection entry: %s', (_, content) => {
    const renderEntry = (experimental?: ExperimentalFeature[]) => {
        const services: DesktopAnalyticsDep = { analytics: mockDesktopAnalytics() };
        const root = createTestCompositionRoot({
            extra: { services },
            preloadedState: {
                ...mockInitialAppState,
                suiteSettings: { ...mockInitialAppState.suiteSettings, experimental },
            },
        });
        renderWithProviders(root, content);

        return root;
    };

    it.each([undefined, [], ['slip24'] as ExperimentalFeature[]])(
        'hides Ledger unless its experimental feature is enabled (%j)',
        experimental => {
            renderEntry(experimental);

            expect(screen.queryByRole('button', { name: 'Connect Ledger' })).toBeNull();
        },
    );

    it('opens the Ledger flow when enabled', () => {
        const root = renderEntry(['ledger']);

        fireEvent.click(screen.getByRole('button', { name: 'Connect Ledger' }));

        expect(root.services.getActions()).toContainEqual(openConnectionModal('ledger'));
    });
});

it('updates connection visibility when Ledger support is toggled in settings', async () => {
    const suiteSettingsReducer = prepareSuiteSettingsReducer({
        actionTypes: { storageLoad: mockActionType('storageLoad') },
        reducers: { storageLoadSuiteSettings: mockReducer() },
    });
    const services: DesktopAnalyticsDep = { analytics: mockDesktopAnalytics() };
    const root = createTestCompositionRoot({
        extra: { services },
        reducer: (state = {}, action) => {
            const previous = { ...mockInitialAppState, ...state };

            return {
                ...previous,
                suiteSettings: suiteSettingsReducer(previous.suiteSettings, action),
            };
        },
    });
    renderWithProviders(
        root,
        <>
            <Experimental />
            <DeviceConnect />
        </>,
    );

    expect(screen.queryByRole('button', { name: 'Connect Ledger' })).toBeNull();
    fireEvent.click(screen.getByTestId('@settings/experimental-features/toggle-switch'));
    const toggle = screen.getByTestId('@settings/experimental-features/ledger-checkbox');
    expect(screen.getByText('Ledger support')).toBeTruthy();

    fireEvent.click(toggle);
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Connect Ledger' })).toBeTruthy(),
    );
    expect(selectHasExperimentalFeature('ledger')(root.store.getState())).toBe(true);

    fireEvent.click(toggle);
    await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Connect Ledger' })).toBeNull(),
    );
    expect(selectHasExperimentalFeature('ledger')(root.store.getState())).toBe(false);
});
