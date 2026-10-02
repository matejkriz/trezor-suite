import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { selectPrerequisite } from './suiteSelectors';

const wallet = {
    ...mockSuiteDevice({
        id: 'ledgerwallet',
        state: { staticSessionId: 'ledgerwallet@ledger:0' },
        connected: true,
        available: true,
    }),
    provider: 'ledger' as const,
};

describe('selectPrerequisite', () => {
    const getState = (selectedDevice?: typeof wallet) =>
        ({
            suite: { transport: undefined },
            router: { app: 'wallet', route: { name: 'wallet-index' } },
            device: {
                selectedDevice,
            },
        }) as unknown as Parameters<typeof selectPrerequisite>[0];

    it('allows wallet pages for a selected Ledger', () => {
        expect(selectPrerequisite(getState(wallet))).toBeNull();
    });

    it('keeps Ledger wallet pages available after USB disconnect', () => {
        expect(selectPrerequisite(getState({ ...wallet, connected: false }))).toBeNull();
    });

    it('still requires a device when no wallet is selected', () => {
        expect(selectPrerequisite(getState())).toBe('device-disconnected');
    });
});
