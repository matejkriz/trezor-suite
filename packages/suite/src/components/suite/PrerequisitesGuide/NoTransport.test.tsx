import '@suite-common/test-utils/globalOverrides';

import { fireEvent } from '@testing-library/react';

import { openConnectionModal } from '@suite/device';
import { createTestCompositionRoot, screen } from '@suite-common/test-utils';

import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { NoTransport } from './NoTransport';
import { mockInitialAppState } from '../../../../mocks/mockInitialAppState';

jest.mock('@trezor/env-utils', () => ({
    ...jest.requireActual('@trezor/env-utils'),
    isDesktop: () => false,
}));

describe('NoTransport', () => {
    it('allows connecting Ledger when the Trezor transport is unavailable', () => {
        const root = createTestCompositionRoot({ preloadedState: mockInitialAppState });
        renderWithProviders(root, <NoTransport />);

        fireEvent.click(screen.getByRole('button', { name: 'Connect Ledger' }));

        expect(root.services.getActions()).toContainEqual(openConnectionModal('ledger'));
    });
});
