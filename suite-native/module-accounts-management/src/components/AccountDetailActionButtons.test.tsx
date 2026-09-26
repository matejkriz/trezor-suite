import { asNetworkSymbol } from '@suite-common/wallet-config';
import { useWalletDeviceAccountCapabilities } from '@suite-common/wallet-core';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { getTranslation } from '@suite-native/intl';
import { renderWithStoreProvider } from '@suite-native/test-utils-store';

import { AccountDetailActionButtons } from './AccountDetailActionButtons';

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    useWalletDeviceAccountCapabilities: jest.fn(),
}));

const account = mockWalletAccount({ symbol: asNetworkSymbol('btc'), availableBalance: '10000' });
const mockCapabilities = jest.mocked(useWalletDeviceAccountCapabilities);

const renderButtons = () =>
    renderWithStoreProvider(<AccountDetailActionButtons accountKey={account.key} />, {
        preloadedState: {
            wallet: { accounts: [account] },
            device: { devices: [], selectedDevice: undefined },
            featureFlags: {},
        },
    });

describe(AccountDetailActionButtons.name, () => {
    it('keeps receive available and hides send for a public discovery account', async () => {
        mockCapabilities.mockReturnValue({ canSignTransaction: false, canConfirmAddress: false });
        const { getByTestId, queryByTestId, getByText } = await renderButtons();

        expect(getByTestId('@account-detail/receive-button')).toBeTruthy();
        expect(queryByTestId('@account-detail/send-button')).toBeNull();
        expect(
            getByText(getTranslation('moduleAccounts.accountDetail.discoveryOnly')),
        ).toBeTruthy();
    });

    it('preserves send and receive for a supported signing account', async () => {
        mockCapabilities.mockReturnValue({ canSignTransaction: true, canConfirmAddress: true });
        const { getByTestId, queryByText } = await renderButtons();

        expect(getByTestId('@account-detail/receive-button')).toBeTruthy();
        expect(getByTestId('@account-detail/send-button')).toBeTruthy();
        expect(
            queryByText(getTranslation('moduleAccounts.accountDetail.discoveryOnly')),
        ).toBeNull();
    });
});
