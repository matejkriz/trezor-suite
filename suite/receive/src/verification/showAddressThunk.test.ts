import { openConnectionModal, setConnectionMode } from '@suite/device';
import { createMockDispatch } from '@suite-common/redux-utils/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { showAddressThunk } from './showAddressThunk';

describe(showAddressThunk.name, () => {
    it('asks to reconnect a selected Ledger before verifying an address', async () => {
        const wallet = {
            ...mockSuiteDevice({
                id: 'ledgerwallet',
                state: { staticSessionId: 'ledgerwallet@ledger:0' },
                connected: false,
                available: false,
            }),
            provider: 'ledger' as const,
        };
        const state = {
            device: {
                selectedDevice: wallet,
            },
            wallet: {
                selectedAccount: { status: 'loaded', account: { key: 'bitcoin-account' } },
            },
            receive: { accounts: {} },
        };
        const { dispatch, actions } = createMockDispatch({ getState: () => state });
        const analytics = { report: jest.fn() };

        await showAddressThunk({ path: "m/84'/0'/0'/0/0" })(
            dispatch as never,
            (() => state) as never,
            { services: { analytics } } as never,
        );

        expect(actions).toContainEqual(openConnectionModal('ledger'));
        expect(actions).toContainEqual(setConnectionMode('cable'));
    });
});
