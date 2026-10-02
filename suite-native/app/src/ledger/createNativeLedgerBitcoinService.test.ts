import { createMockDeps } from '@suite-common/dependency-injection';
import { type LedgerBitcoinServiceDep, type LedgerDevice } from '@suite-common/ledger';

import { createNativeLedgerBitcoinService } from './createNativeLedgerBitcoinService';

const device: LedgerDevice = {
    id: 'ledger',
    name: 'My Ledger',
    transport: 'react-native-ble',
    deviceModel: {
        id: 'flex',
        model: 'flex' as LedgerDevice['deviceModel']['model'],
        name: 'Ledger Flex',
    },
};

const prepareTest = () => {
    const { ledgerBitcoinService: service } = createMockDeps<LedgerBitcoinServiceDep>({
        ledgerBitcoinService: {
            startDiscovery: () => () => Promise.resolve(),
            stopDiscovery: () => Promise.resolve(),
            listenToAvailableDevices: () => () => undefined,
            connect: () => Promise.resolve(),
            isConnectionOwner: () => true,
            disconnect: () => Promise.resolve(),
            dispose: () => Promise.resolve(),
            getDeviceInfo: () => undefined,
            getMasterFingerprint: null,
            getAccount: null,
            hasAccountsDiscovery: () => Promise.resolve(false),
            openAccountsDiscovery: null,
            verifyAddress: null,
            signPsbt: null,
            signTransaction: null,
            cancelAction: null,
        },
    });
    const resumeTrezorScan = jest.fn();
    const suspendDeviceScan = jest.fn().mockResolvedValue(resumeTrezorScan);
    const createService = jest.fn(() => service);
    const wrapper = createNativeLedgerBitcoinService({ createService, suspendDeviceScan });

    return { wrapper, service, createService, suspendDeviceScan, resumeTrezorScan };
};

describe('native Ledger Bluetooth lifecycle', () => {
    it('delegates installed-app detection to the connected transport service', async () => {
        const { wrapper, service } = prepareTest();
        await wrapper.connect(device);
        service.hasAccountsDiscovery.mockResolvedValue(true);

        await expect(wrapper.hasAccountsDiscovery()).resolves.toBe(true);
        expect(service.hasAccountsDiscovery).toHaveBeenCalledTimes(1);
    });

    it('does not construct DMK or Bluetooth at startup or during unused cleanup', async () => {
        const { wrapper, createService, suspendDeviceScan } = prepareTest();

        expect(wrapper.getDeviceInfo()).toBeUndefined();
        wrapper.cancelAction();
        await wrapper.stopDiscovery();
        await wrapper.disconnect();
        await wrapper.dispose();

        expect(createService).not.toHaveBeenCalled();
        expect(suspendDeviceScan).not.toHaveBeenCalled();
    });

    it('stops the Ledger scanner before restoring Trezor scanning and reuses DMK', async () => {
        const { wrapper, service, createService, suspendDeviceScan, resumeTrezorScan } =
            prepareTest();
        const onError = jest.fn();
        const started = new Promise<void>(resolve => {
            service.startDiscovery.mockImplementationOnce(() => {
                resolve();

                return () => Promise.resolve();
            });
        });
        wrapper.startDiscovery(jest.fn(), onError);
        await started;
        await wrapper.stopDiscovery();

        expect(service.startDiscovery).toHaveBeenCalledTimes(1);
        expect(service.stopDiscovery).toHaveBeenCalledTimes(1);
        expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
        expect(service.stopDiscovery.mock.invocationCallOrder[0]).toBeLessThan(
            resumeTrezorScan.mock.invocationCallOrder[0] ?? 0,
        );
        await wrapper.connect(device);
        expect(createService).toHaveBeenCalledTimes(1);
        expect(suspendDeviceScan).toHaveBeenCalledTimes(2);
        expect(resumeTrezorScan).toHaveBeenCalledTimes(2);
        expect(onError).not.toHaveBeenCalled();
    });

    it('does not initialize or start a pending scan after the screen closes', async () => {
        const { wrapper, createService, suspendDeviceScan, resumeTrezorScan } = prepareTest();
        let finishSuspending: (resume: () => void) => void = () => undefined;
        let markSuspending: () => void = () => undefined;
        const suspending = new Promise<void>(resolve => {
            markSuspending = resolve;
        });
        suspendDeviceScan.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishSuspending = resolve;
                    markSuspending();
                }),
        );
        wrapper.startDiscovery(jest.fn(), jest.fn());
        await suspending;
        const stopping = wrapper.stopDiscovery();
        finishSuspending(resumeTrezorScan);
        await stopping;

        expect(createService).not.toHaveBeenCalled();
        expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
    });

    it('does not connect after an acquisition is canceled during scan suspension', async () => {
        const { wrapper, service, suspendDeviceScan, resumeTrezorScan } = prepareTest();
        let finishSuspending: (resume: () => void) => void = () => undefined;
        let markSuspending: () => void = () => undefined;
        const suspending = new Promise<void>(resolve => {
            markSuspending = resolve;
        });
        suspendDeviceScan.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishSuspending = resolve;
                    markSuspending();
                }),
        );
        const connecting = wrapper.connect(device, { owner: 'first' });
        await suspending;
        const disconnecting = wrapper.disconnect({ owner: 'first' });
        finishSuspending(resumeTrezorScan);

        await expect(connecting).rejects.toThrow('Ledger connection canceled');
        await disconnecting;
        expect(service.connect).not.toHaveBeenCalled();
        expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
    });

    it('ignores cleanup from an older acquisition owner', async () => {
        const { wrapper, service } = prepareTest();
        await wrapper.connect(device, { owner: 'current' });
        service.isConnectionOwner.mockImplementation(owner => owner === 'current');

        await wrapper.disconnect({ owner: 'stale' });

        expect(service.disconnect).not.toHaveBeenCalled();
        expect(wrapper.isConnectionOwner('current')).toBe(true);
    });

    it('releases scan ownership after a scan error before reporting the failure', async () => {
        const { wrapper, service, resumeTrezorScan } = prepareTest();
        service.startDiscovery.mockImplementationOnce((_onDevice, onError) => {
            onError(new Error('Bluetooth is off'));

            return () => Promise.resolve();
        });
        await new Promise<void>(resolve => {
            wrapper.startDiscovery(jest.fn(), () => {
                expect(service.stopDiscovery).toHaveBeenCalledTimes(1);
                expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
                resolve();
            });
        });
    });

    it('replaces the prior scan and ignores its late cleanup handle', async () => {
        const { wrapper, service, resumeTrezorScan } = prepareTest();
        let firstStarted: () => void = () => undefined;
        const first = new Promise<void>(resolve => {
            firstStarted = resolve;
        });
        service.startDiscovery.mockImplementationOnce(() => {
            firstStarted();

            return () => Promise.resolve();
        });
        const stopFirst = wrapper.startDiscovery(jest.fn(), jest.fn());
        await first;
        let secondStarted: () => void = () => undefined;
        const second = new Promise<void>(resolve => {
            secondStarted = resolve;
        });
        service.startDiscovery.mockImplementationOnce(() => {
            secondStarted();

            return () => Promise.resolve();
        });
        const stopSecond = wrapper.startDiscovery(jest.fn(), jest.fn());
        await second;
        await stopFirst();

        expect(service.stopDiscovery).toHaveBeenCalledTimes(1);
        expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
        await stopSecond();
        expect(service.stopDiscovery).toHaveBeenCalledTimes(2);
        expect(resumeTrezorScan).toHaveBeenCalledTimes(2);
    });

    it('allows a newer connection to supersede one stalled on device interaction', async () => {
        const { wrapper, service, resumeTrezorScan } = prepareTest();
        let finishFirst: () => void = () => undefined;
        let markFirstStarted: () => void = () => undefined;
        const firstStarted = new Promise<void>(resolve => {
            markFirstStarted = resolve;
        });
        service.connect.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    finishFirst = resolve;
                    markFirstStarted();
                }),
        );
        const first = wrapper.connect(device, { owner: 'first' });
        await firstStarted;
        await wrapper.connect(device, { owner: 'second' });
        service.isConnectionOwner.mockImplementation(owner => owner === 'second');
        await wrapper.disconnect({ owner: 'first' });

        expect(service.connect).toHaveBeenCalledTimes(2);
        expect(service.disconnect).not.toHaveBeenCalled();
        expect(resumeTrezorScan).toHaveBeenCalledTimes(1);
        finishFirst();
        await expect(first).rejects.toThrow('Ledger connection canceled');
        expect(wrapper.isConnectionOwner('second')).toBe(true);
        expect(resumeTrezorScan).toHaveBeenCalledTimes(2);
    });

    it('does not stop a newer scan when an older disconnect finishes late', async () => {
        const { wrapper, service, resumeTrezorScan } = prepareTest();
        await wrapper.connect(device, { owner: 'first' });
        let finishDisconnect: () => void = () => undefined;
        service.disconnect.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    finishDisconnect = resolve;
                }),
        );
        const disconnecting = wrapper.disconnect({ owner: 'first' });
        await wrapper.connect(device, { owner: 'second' });
        const started = new Promise<void>(resolve => {
            service.startDiscovery.mockImplementationOnce(() => {
                resolve();

                return () => Promise.resolve();
            });
        });
        const stopScan = wrapper.startDiscovery(jest.fn(), jest.fn());
        await started;
        finishDisconnect();
        await disconnecting;

        expect(service.stopDiscovery).not.toHaveBeenCalled();
        expect(resumeTrezorScan).toHaveBeenCalledTimes(2);
        await stopScan();
        expect(service.stopDiscovery).toHaveBeenCalledTimes(1);
    });
});
