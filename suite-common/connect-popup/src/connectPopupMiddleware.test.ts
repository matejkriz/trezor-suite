import { type LedgerSuiteDevice, deviceInitialState } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestStore } from '@suite-common/test-utils';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import TrezorConnect, { UI_REQUESTS, UI_RESPONSE } from '@trezor/connect';

import { prepareConnectPopupMiddleware } from './connectPopupMiddleware';

describe('Connect popup discovery account response', () => {
    it('never exports a selected Ledger account to Trezor Connect', async () => {
        const ledgerDevice = {
            ...mockSuiteDevice({ connected: true }),
            provider: 'ledger' as const,
            state: { staticSessionId: 'ledger@ledger:0' as const },
        } as LedgerSuiteDevice;
        const account = mockWalletAccount({
            descriptor: asAccountDescriptor('ledgerprivateaccountdescriptor'),
            deviceState: ledgerDevice.state.staticSessionId,
            symbol: asNetworkSymbol('btc'),
        });
        const state = {
            device: { ...deviceInitialState, selectedDevice: ledgerDevice },
            wallet: { accounts: [account], discovery: {} },
        };
        const uiResponse = jest.spyOn(TrezorConnect, 'uiResponse').mockImplementation(() => {});
        const store = createTestStore({
            extra: undefined,
            reducer: (current = state) => current,
            middleware: [prepareConnectPopupMiddleware(() => ({}))],
        });

        await store.dispatch({
            type: UI_REQUESTS.REQUEST_DISCOVERY_ACCOUNTS,
            payload: { coinInfo: { shortcut: 'BTC' } },
        });

        expect(uiResponse).toHaveBeenCalledWith({
            type: UI_RESPONSE.RECEIVE_DISCOVERY_ACCOUNTS,
            payload: null,
        });
        expect(JSON.stringify(uiResponse.mock.calls)).not.toContain(account.descriptor);
        uiResponse.mockRestore();
    });
});
