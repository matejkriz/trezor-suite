import { createMockDeps } from '@suite-common/dependency-injection';
import { type LedgerSuiteDevice } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import TrezorConnect from '@trezor/connect';

import {
    type WalletDeviceServiceDeps,
    createWalletDeviceService,
} from './createWalletDeviceService';

const ledgerDevice = {
    ...mockSuiteDevice({ connected: true, state: { sessionId: 'acquisition-a' } }),
    provider: 'ledger',
} as LedgerSuiteDevice;

describe('wallet device service', () => {
    it('resolves only the adapter for the selected vendor', () => {
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            ledgerBitcoinService: {
                isConnectionOwner: () => true,
                cancelAction: () => undefined,
                disconnect: () => Promise.resolve(),
                verifyAddress: null,
                getAccount: null,
                signTransaction: null,
            },
            dispatch: action => action,
        });
        const service = createWalletDeviceService(deps);

        expect(service.get(ledgerDevice)).toBeDefined();
        expect(service.get(mockSuiteDevice())).toBeUndefined();
    });

    it('cancels Ledger without canceling Trezor Connect', async () => {
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            ledgerBitcoinService: {
                isConnectionOwner: () => true,
                cancelAction: () => undefined,
                disconnect: () => Promise.resolve(),
                verifyAddress: null,
                getAccount: null,
                signTransaction: null,
            },
            dispatch: action => action,
        });
        const cancelTrezor = jest
            .spyOn(TrezorConnect, 'cancel')
            .mockImplementation(() => undefined);

        await createWalletDeviceService(deps).cancelAction({ device: ledgerDevice });

        expect(deps.ledgerBitcoinService.cancelAction).toHaveBeenCalled();
        expect(cancelTrezor).not.toHaveBeenCalled();
        cancelTrezor.mockRestore();
    });

    it('preserves the reason when canceling Trezor', async () => {
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            ledgerBitcoinService: {
                isConnectionOwner: () => true,
                cancelAction: () => undefined,
                disconnect: () => Promise.resolve(),
                verifyAddress: null,
                getAccount: null,
                signTransaction: null,
            },
            dispatch: action => action,
        });
        const cancelTrezor = jest
            .spyOn(TrezorConnect, 'cancel')
            .mockImplementation(() => undefined);

        await createWalletDeviceService(deps).cancelAction({
            device: mockSuiteDevice(),
            reason: 'tx-timeout',
        });

        expect(cancelTrezor).toHaveBeenCalledWith('tx-timeout');
        expect(deps.ledgerBitcoinService.cancelAction).not.toHaveBeenCalled();
        cancelTrezor.mockRestore();
    });

    it.each(['tx-timeout', { reason: 'tx-timeout' }])(
        'maps timeout cancellation to the Ledger adapter',
        async reason => {
            const deps = createMockDeps<WalletDeviceServiceDeps>({
                ledgerBitcoinService: {
                    isConnectionOwner: () => true,
                    cancelAction: () => undefined,
                    disconnect: null,
                    verifyAddress: null,
                    getAccount: null,
                    signTransaction: null,
                },
                dispatch: action => action,
            });

            await createWalletDeviceService(deps).cancelAction({ device: ledgerDevice, reason });

            expect(deps.ledgerBitcoinService.cancelAction).toHaveBeenCalledWith('timeout');
        },
    );

    it('disconnects the Ledger session through its injected transport', async () => {
        const deps = createMockDeps<WalletDeviceServiceDeps>({
            ledgerBitcoinService: {
                isConnectionOwner: () => true,
                cancelAction: () => undefined,
                disconnect: () => Promise.resolve(),
                verifyAddress: null,
                getAccount: null,
                signTransaction: null,
            },
            dispatch: action => action,
        });

        await createWalletDeviceService(deps).disconnect(ledgerDevice);

        expect(deps.ledgerBitcoinService.disconnect).toHaveBeenCalledWith({
            owner: 'acquisition-a',
        });
    });

    it.each([
        { device: { ...ledgerDevice, connected: false }, ownsConnection: true },
        {
            device: { ...ledgerDevice, state: { staticSessionId: 'restored@ledger:0' as const } },
            ownsConnection: true,
        },
        { device: ledgerDevice, ownsConnection: false },
    ])(
        'does not cancel or disconnect a replaced or restored session',
        async ({ device, ownsConnection }) => {
            const deps = createMockDeps<WalletDeviceServiceDeps>({
                ledgerBitcoinService: {
                    isConnectionOwner: () => ownsConnection,
                    cancelAction: () => undefined,
                    disconnect: () => Promise.resolve(),
                    verifyAddress: null,
                    getAccount: null,
                    signTransaction: null,
                },
                dispatch: action => action,
            });
            const service = createWalletDeviceService(deps);

            await service.cancelAction({ device });
            await service.disconnect(device);

            expect(deps.ledgerBitcoinService.cancelAction).not.toHaveBeenCalled();
            expect(deps.ledgerBitcoinService.disconnect).not.toHaveBeenCalled();
        },
    );
});
