import { type ReactNode } from 'react';

import '@suite-common/test-utils/globalOverrides';

import { createTestCompositionRoot, screen } from '@suite-common/test-utils';
import { createLedgerSuiteDevice } from '@suite-common/wallet-core';

import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { SettingsDevice } from './SettingsDevice';
import { mockInitialAppState } from '../../../../mocks/mockInitialAppState';

jest.mock('src/components/settings/SettingsLayout', () => ({
    SettingsLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('Ledger Device settings', () => {
    it('shows only available read-only device information and the local forget action', () => {
        const device = createLedgerSuiteDevice({
            id: 'ledger-wallet',
            label: 'My Ledger',
            staticSessionId: 'ledger-wallet@ledger:0',
            deviceInfo: {
                name: 'My Ledger',
                model: 'Ledger Flex',
                osVersion: '1.3.0',
                bitcoinAppVersion: '2.4.0',
                batteryLevel: 80,
            },
        });
        const root = createTestCompositionRoot({
            preloadedState: {
                ...mockInitialAppState,
                device: {
                    ...mockInitialAppState.device,
                    devices: [device],
                    selectedDevice: device,
                },
            },
        });

        renderWithProviders(root, <SettingsDevice />);

        expect(screen.getByTestId('@settings/device/info/name')).toHaveTextContent('My Ledger');
        expect(screen.getByTestId('@settings/device/info/model')).toHaveTextContent('Ledger Flex');
        expect(screen.getByTestId('@settings/device/info/os-version')).toHaveTextContent('1.3.0');
        expect(screen.getByTestId('@settings/device/info/bitcoin-app-version')).toHaveTextContent(
            '2.4.0',
        );
        expect(screen.getByTestId('@settings/device/info/battery')).toHaveTextContent('80%');
        expect(screen.getByTestId('@settings/device/forget-button')).toBeInTheDocument();
        expect(screen.getByTestId('@settings/device/forget')).toHaveTextContent(
            'Remove this Ledger from Trezor Suite',
        );
        expect(screen.queryByTestId('@settings/device/update-button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /check origin/i })).not.toBeInTheDocument();
    });
});
