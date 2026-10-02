import '@suite-common/test-utils/globalOverrides';

import { act, fireEvent, waitFor } from '@testing-library/react';

import { createMockDeps, mock } from '@suite-common/dependency-injection';
import { type LedgerSuiteDevice } from '@suite-common/device';
import { type LedgerBitcoinServiceDep, type LedgerDevice } from '@suite-common/ledger';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot, screen } from '@suite-common/test-utils';
import { connectLedgerBitcoinWalletThunk } from '@suite-common/wallet-core';
import { type StaticSessionId } from '@trezor/connect';

import { type SuiteServices } from 'src/support/createSuiteCompositionRoot';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { LedgerConnectionModal } from './LedgerConnectionModal';
import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

const mockAbort = jest.fn();
const mockUnwrap = jest.fn();

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    connectLedgerBitcoinWalletThunk: jest.fn(() => () => ({
        unwrap: mockUnwrap,
        abort: mockAbort,
    })),
}));

jest.mock('src/actions/wallet/addWalletThunk', () => ({
    redirectAfterWalletSelectedThunk: () => ({ type: 'redirectAfterWalletSelected' }),
}));

jest.mock('src/support/createSuiteCompositionRoot', () => ({
    selectSuiteServices: (services: SuiteServices) => services,
}));

const device: LedgerDevice = {
    id: 'test-ledger',
    name: 'Travel Ledger',
    transport: 'web-hid',
    deviceModel: {
        id: 'flex',
        name: 'Ledger Flex',
        model: 'flex' as LedgerDevice['deviceModel']['model'],
    },
};

const renderModal = (selectedDevice?: LedgerSuiteDevice) => {
    const services = createMockDeps<LedgerBitcoinServiceDep>({
        ledgerBitcoinService: {
            listenToAvailableDevices: onDevices => {
                onDevices([device]);

                return () => undefined;
            },
            startDiscovery: null,
            stopDiscovery: null,
            connect: null,
            isConnectionOwner: null,
            getDeviceInfo: null,
            getMasterFingerprint: null,
            getAccount: null,
            hasAccountsDiscovery: () => Promise.resolve(false),
            openAccountsDiscovery: null,
            verifyAddress: null,
            signPsbt: null,
            signTransaction: null,
            cancelAction: null,
            disconnect: null,
            dispose: null,
        },
    });
    const root = createTestCompositionRoot({
        extra: { services },
        preloadedState: {
            ...mockInitialAppState,
            device: { ...mockInitialAppState.device, selectedDevice },
        },
    });
    const onCancel = mock<() => void>();
    renderWithProviders(
        root,
        <LedgerConnectionModal onCancel={onCancel} onBack={mock<() => void>()} />,
    );

    return { onCancel };
};

describe('LedgerConnectionModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUnwrap.mockResolvedValue(mockSuiteDevice({ id: device.id }));
    });

    it('keeps the existing Bitcoin connection as the default', async () => {
        const { onCancel } = renderModal();
        expect(screen.getByText(/Confirm opening the Bitcoin app/)).toBeTruthy();

        await act(() => {
            fireEvent.click(screen.getByRole('button', { name: device.name }));

            return Promise.resolve();
        });

        expect(connectLedgerBitcoinWalletThunk).toHaveBeenCalledWith({
            device,
            useAccountsDiscovery: false,
        });
        await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('opens Accounts Discovery only after enabling its connection option', async () => {
        renderModal();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Use Accounts Discovery' }));

        expect(screen.getByText(/approve exporting public account data/)).toBeTruthy();
        await act(() => {
            fireEvent.click(screen.getByRole('button', { name: device.name }));

            return Promise.resolve();
        });

        expect(connectLedgerBitcoinWalletThunk).toHaveBeenCalledWith({
            device,
            useAccountsDiscovery: true,
        });
    });

    it('restores the mode for a previously discovered Ledger', () => {
        const selectedDevice = mockSuiteDevice();
        if (selectedDevice.type !== 'acquired') throw new Error('Expected acquired fixture');
        const ledgerDevice: LedgerSuiteDevice = {
            ...selectedDevice,
            provider: 'ledger',
            id: 'remembered-ledger-wallet',
            state: {
                staticSessionId: 'remembered-ledger-wallet' as StaticSessionId,
            },
            ledgerInfo: { model: 'Ledger Flex', accountsDiscoveryAppVersion: '1.0.0' },
        };
        renderModal(ledgerDevice);

        expect(screen.getByRole('checkbox', { name: 'Use Accounts Discovery' })).toBeChecked();
        expect(screen.getByText(/approve exporting public account data/)).toBeTruthy();
    });
});
