import {
    DeviceActionStatus,
    DeviceModel,
    DeviceModelId,
    type DiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import { type SignerBtc } from '@ledgerhq/device-signer-kit-bitcoin';
import { EMPTY, Subject, of, throwError } from 'rxjs';

import { createMockDeps } from '@suite-common/dependency-injection';

import {
    type LedgerBitcoinServiceDeps,
    createLedgerBitcoinService,
} from './createLedgerBitcoinService';

const device: DiscoveredDevice = {
    id: 'ledger-1',
    name: 'Ledger Nano S Plus',
    deviceModel: new DeviceModel({
        id: 'nanoSP',
        model: DeviceModelId.NANO_SP,
        name: 'Ledger Nano S Plus',
    }),
    transport: 'web-hid',
};

const createDeps = () => {
    const signer: Pick<SignerBtc, 'getExtendedPublicKey' | 'getWalletAddress' | 'signPsbt'> = {
        getExtendedPublicKey: jest.fn(() => ({
            observable: of({
                status: DeviceActionStatus.Completed,
                output: { extendedPublicKey: 'xpub-ledger' },
            }),
            cancel: jest.fn(),
        })),
        getWalletAddress: jest.fn(() => ({
            observable: of({
                status: DeviceActionStatus.Completed,
                output: { address: 'bc1qledger' },
            }),
            cancel: jest.fn(),
        })),
        signPsbt: jest.fn(() => ({
            observable: of({ status: DeviceActionStatus.Completed, output: [] }),
            cancel: jest.fn(),
        })),
    };

    return createMockDeps<LedgerBitcoinServiceDeps>({
        dmk: {
            startDiscovering: () => of(device),
            stopDiscovering: () => Promise.resolve(),
            connect: () => Promise.resolve('session-1'),
            disconnect: () => Promise.resolve(),
            close: () => undefined,
        },
        createSigner: () => signer,
    });
};

describe('createLedgerBitcoinService', () => {
    it('uses the supplied device stream when transport discovery emits no devices', () => {
        const deps = createDeps();
        deps.dmk.startDiscovering.mockReturnValue(EMPTY);
        deps.listenToAvailableDevices = jest.fn(() => of([device]));
        const service = createLedgerBitcoinService(deps);
        const onDevice = jest.fn();

        service.startDiscovery(onDevice, jest.fn());

        expect(onDevice).toHaveBeenCalledWith(device);
        expect(deps.dmk.startDiscovering).not.toHaveBeenCalled();
    });

    it('stops listening to available devices when scanning ends', async () => {
        const deps = createDeps();
        const availableDevices = new Subject<DiscoveredDevice[]>();
        deps.listenToAvailableDevices = jest.fn(() => availableDevices);
        const service = createLedgerBitcoinService(deps);
        const onDevice = jest.fn();

        service.startDiscovery(onDevice, jest.fn());
        availableDevices.next([device]);
        await service.stopDiscovery();
        availableDevices.next([device]);

        expect(onDevice).toHaveBeenCalledTimes(1);
        expect(deps.dmk.stopDiscovering).toHaveBeenCalledTimes(1);
    });

    it('discovers, connects and derives a native SegWit account with the Bitcoin signer', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);
        const onDevice = jest.fn();

        service.startDiscovery(onDevice, jest.fn());
        expect(onDevice).toHaveBeenCalledWith(device);

        await service.connect(device);
        await expect(service.getAccount(0)).resolves.toEqual({
            path: "84'/0'/0'",
            extendedPublicKey: 'xpub-ledger',
            address: 'bc1qledger',
        });
        expect(deps.dmk.connect).toHaveBeenCalledWith({ device });
        expect(deps.createSigner).toHaveBeenCalledWith('session-1');
        expect(deps.createSigner.mock.results[0]?.value.getWalletAddress).toHaveBeenCalledWith(
            expect.objectContaining({ derivationPath: "84'/0'/0'" }),
            0,
        );
    });

    it('requires a connection before deriving account data', async () => {
        const service = createLedgerBitcoinService(createDeps());

        await expect(service.getAccount(0)).rejects.toThrow('Ledger device is not connected');
    });

    it('does not keep the previous signer after a reconnect fails', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        deps.dmk.connect.mockRejectedValueOnce(new Error('Device disconnected'));
        await expect(service.connect(device)).rejects.toThrow('Device disconnected');
        await expect(service.getAccount(0)).rejects.toThrow('Ledger device is not connected');
    });

    it('disconnects the session during cleanup', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        await service.disconnect();

        expect(deps.dmk.disconnect).toHaveBeenCalledWith({ sessionId: 'session-1' });
    });

    it('closes the device kit when disposed', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        await service.dispose();

        expect(deps.dmk.disconnect).toHaveBeenCalledWith({ sessionId: 'session-1' });
        expect(deps.dmk.close).toHaveBeenCalledTimes(1);
    });

    it('requests on-device address confirmation', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        await expect(service.verifyAddress(0, 0)).resolves.toBe('bc1qledger');

        expect(deps.createSigner.mock.results[0]?.value.getWalletAddress).toHaveBeenCalledWith(
            expect.objectContaining({ derivationPath: "84'/0'/0'" }),
            0,
            { checkOnDevice: true },
        );
    });

    it('passes a Bitcoin PSBT through the signer kit', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        await expect(service.signPsbt(0, 'cHNidA==')).resolves.toEqual([]);

        expect(deps.createSigner.mock.results[0]?.value.signPsbt).toHaveBeenCalledWith(
            expect.objectContaining({ derivationPath: "84'/0'/0'" }),
            'cHNidA==',
        );
    });

    it('allows a new discovery attempt after an earlier scan fails', () => {
        const deps = createDeps();
        const scanError = new Error('Bluetooth unavailable');
        deps.dmk.startDiscovering.mockReturnValueOnce(throwError(() => scanError));
        const service = createLedgerBitcoinService(deps);
        const onDevice = jest.fn();
        const onError = jest.fn();

        service.startDiscovery(onDevice, onError);
        service.startDiscovery(onDevice, onError);

        expect(onError).toHaveBeenCalledWith(scanError);
        expect(onDevice).toHaveBeenCalledWith(device);
        expect(deps.dmk.startDiscovering).toHaveBeenCalledTimes(2);
    });
});
