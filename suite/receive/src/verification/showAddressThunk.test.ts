import { openConnectionModal } from '@suite/device';

import { showAddressThunk } from './showAddressThunk';

describe(showAddressThunk.name, () => {
    it('asks to reconnect a selected Ledger before verifying an address', async () => {
        const wallet = {
            id: 'ledgerwallet',
            provider: 'ledger',
            label: 'Ledger',
            staticSessionId: 'ledgerwallet@ledger:0',
            connected: false,
        };
        const state = {
            device: {
                selectedDevice: undefined,
                externalWallets: [wallet],
                selectedExternalWalletId: wallet.id,
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
