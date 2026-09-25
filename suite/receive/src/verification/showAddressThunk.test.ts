import { openConnectionModal } from '@suite/device';
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
        const dispatch = jest.fn();
        const analytics = { report: jest.fn() };

        await showAddressThunk({ path: "m/84'/0'/0'/0/0" })(
            dispatch as never,
            (() => state) as never,
            { services: { analytics } } as never,
        );

        expect(dispatch).toHaveBeenCalledWith(openConnectionModal('ledger'));
    });
});
