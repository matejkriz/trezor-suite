import { type bluetoothManager } from './bluetoothManager';

jest.mock('react-native-ble-plx', () => ({
    BleManager: jest.fn(() => ({
        setLogLevel: jest.fn(),
        startDeviceScan: jest.fn(),
        stopDeviceScan: jest.fn().mockResolvedValue(undefined),
    })),
    LogLevel: { Verbose: 'Verbose' },
    BleErrorCode: {},
}));

const createManager = () => {
    let manager: typeof bluetoothManager;
    let createBleManager: jest.Mock;
    jest.isolateModules(() => {
        manager = jest.requireActual('./bluetoothManager').bluetoothManager;
        createBleManager = jest.requireMock('react-native-ble-plx').BleManager;
    });

    return { manager: manager!, createBleManager: createBleManager! };
};

describe('Bluetooth scan ownership', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('does not initialize native Bluetooth while suspending an unused scanner', async () => {
        const { manager, createBleManager } = createManager();

        const resume = await manager.suspendDeviceScan();
        resume();

        expect(createBleManager).not.toHaveBeenCalled();
    });

    it('pauses Trezor scanning and ignores app lifecycle scan operations until resumed', async () => {
        const { manager, createBleManager } = createManager();
        manager.startDeviceScan();
        const nativeManager = createBleManager.mock.results[0]?.value;

        const resume = await manager.suspendDeviceScan();
        manager.startDeviceScan();
        manager.stopDeviceScan();
        manager.startDeviceScan();

        expect(nativeManager.stopDeviceScan).toHaveBeenCalledTimes(1);
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(1);
        resume();
        resume();
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(2);
        manager.stopDeviceScan();
    });

    it('waits for all scan owners and does not restart scanning no longer requested', async () => {
        const { manager, createBleManager } = createManager();
        manager.startDeviceScan();
        const nativeManager = createBleManager.mock.results[0]?.value;
        const firstResume = await manager.suspendDeviceScan();
        const secondResume = await manager.suspendDeviceScan();

        firstResume();
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(1);
        manager.stopDeviceScan();
        secondResume();
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(1);
    });

    it('waits for the native stop before granting a second scan suspension', async () => {
        const { manager, createBleManager } = createManager();
        manager.startDeviceScan();
        const nativeManager = createBleManager.mock.results[0]?.value;
        let finishStopping: () => void = () => undefined;
        nativeManager.stopDeviceScan.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    finishStopping = resolve;
                }),
        );
        const first = manager.suspendDeviceScan();
        let secondGranted = false;
        const second = manager.suspendDeviceScan().then(resume => {
            secondGranted = true;

            return resume;
        });
        await Promise.resolve();
        expect(secondGranted).toBe(false);
        finishStopping();
        const firstResume = await first;
        const secondResume = await second;
        firstResume();
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(1);
        secondResume();
        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(2);
        manager.stopDeviceScan();
    });

    it('does not retain a suspension after native scan cleanup fails', async () => {
        const { manager, createBleManager } = createManager();
        manager.startDeviceScan();
        const nativeManager = createBleManager.mock.results[0]?.value;
        nativeManager.stopDeviceScan.mockRejectedValueOnce(new Error('Adapter unavailable'));

        await expect(manager.suspendDeviceScan()).rejects.toThrow('Adapter unavailable');
        manager.startDeviceScan();

        expect(nativeManager.startDeviceScan).toHaveBeenCalledTimes(3);
        manager.stopDeviceScan();
    });
});
