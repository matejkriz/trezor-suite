import {
    DeviceActionStatus,
    DeviceModel,
    DeviceModelId,
    type DeviceSessionState,
    DeviceSessionStateType,
    DeviceStatus,
    type DiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import { type SignerBtc } from '@ledgerhq/device-signer-kit-bitcoin';
import { EMPTY, NEVER, Subject, of, throwError } from 'rxjs';

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

const extendedPublicKey =
    'xpub6DDUPHpUo4pcy43iJeZjbSVWGav1SMMmuWdMHiGtkK8rhKmfbomtkwW6GKs1GGAKehT6QRocrmda3WWxXawpjmwaUHfFRXuKrXSapdckEYF';
const descriptor =
    'zpub6rszzdAK6RuafeRwyN8z1cgWcXCuKbLmjjfnrW4fWKtcoXQ8787214pNJjnBG5UATyghuNzjn6Lfp5k5xymrLFJnCy46bMYJPyZsbpFGagT';
const firstAddress = 'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk';

const createDeps = (
    address = firstAddress,
    serializedTransaction: `0x${string}` = '0x02000000',
) => {
    const signer: Pick<
        SignerBtc,
        | 'getExtendedPublicKey'
        | 'getMasterFingerprint'
        | 'getWalletAddress'
        | 'signPsbt'
        | 'signTransaction'
    > = {
        getExtendedPublicKey: jest.fn(() => ({
            observable: of({
                status: DeviceActionStatus.Completed,
                output: { extendedPublicKey },
            }),
            cancel: jest.fn(),
        })),
        getMasterFingerprint: jest.fn(() => ({
            observable: of({
                status: DeviceActionStatus.Completed,
                output: { masterFingerprint: Uint8Array.of(0x5c, 0x9e, 0x22, 0x8d) },
            }),
            cancel: jest.fn(),
        })),
        getWalletAddress: jest.fn(() => ({
            observable: of({
                status: DeviceActionStatus.Completed,
                output: { address },
            }),
            cancel: jest.fn(),
        })),
        signPsbt: jest.fn(() => ({
            observable: of({ status: DeviceActionStatus.Completed, output: [] }),
            cancel: jest.fn(),
        })),
        signTransaction: jest.fn(() => ({
            observable: of({ status: DeviceActionStatus.Completed, output: serializedTransaction }),
            cancel: jest.fn(),
        })),
    };

    return createMockDeps<LedgerBitcoinServiceDeps>({
        dmk: {
            startDiscovering: () => of(device),
            listenToAvailableDevices: () => of([device]),
            stopDiscovering: () => Promise.resolve(),
            connect: () => Promise.resolve('session-1'),
            getDeviceSessionState: () => NEVER,
            disconnect: () => Promise.resolve(),
            close: () => undefined,
        },
        createSigner: () => signer,
        onDisconnect: jest.fn(),
    });
};

describe('createLedgerBitcoinService', () => {
    it('exposes device details reported by the connected Ledger session', async () => {
        const deps = createDeps();
        const sessionState = new Subject<DeviceSessionState>();
        deps.dmk.getDeviceSessionState.mockReturnValue(sessionState);
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        sessionState.next({
            sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
            deviceStatus: DeviceStatus.CONNECTED,
            deviceModelId: DeviceModelId.NANO_SP,
            deviceName: 'My Ledger',
            firmwareVersion: { os: '1.2.3', mcu: '1.0', bootloader: '1.0' },
            currentApp: { name: 'Bitcoin', version: '2.4.0' },
            batteryStatus: { level: 90 },
        } as DeviceSessionState);

        expect(service.getDeviceInfo()).toEqual({
            name: 'My Ledger',
            model: 'Ledger Nano S Plus',
            osVersion: '1.2.3',
            bitcoinAppVersion: '2.4.0',
            batteryLevel: 90,
        });

        sessionState.next({ deviceStatus: DeviceStatus.NOT_CONNECTED } as DeviceSessionState);
        expect(service.getDeviceInfo()).toBeUndefined();
    });

    it('clears the signer and reports a physically disconnected Ledger', async () => {
        const deps = createDeps();
        const sessionState = new Subject<DeviceSessionState>();
        deps.dmk.getDeviceSessionState.mockReturnValue(sessionState);
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        sessionState.next({ deviceStatus: DeviceStatus.NOT_CONNECTED } as DeviceSessionState);

        expect(deps.onDisconnect).toHaveBeenCalledTimes(1);
        await expect(service.getAccount(0)).rejects.toThrow('Ledger device is not connected');
    });

    it('lists previously available devices without starting interactive discovery', () => {
        const deps = createDeps();
        const availableDevices = new Subject<DiscoveredDevice[]>();
        deps.dmk.listenToAvailableDevices.mockReturnValue(availableDevices);
        const service = createLedgerBitcoinService(deps);
        const onDevices = jest.fn();

        const stopListening = service.listenToAvailableDevices(onDevices, jest.fn());
        availableDevices.next([device]);

        expect(onDevices).toHaveBeenCalledWith([device]);
        expect(deps.dmk.listenToAvailableDevices).toHaveBeenCalledWith({});
        expect(deps.dmk.startDiscovering).not.toHaveBeenCalled();

        stopListening();
        availableDevices.next([]);
        expect(onDevices).toHaveBeenCalledTimes(1);
    });

    it('stops available-device listening when disconnected', async () => {
        const deps = createDeps();
        const availableDevices = new Subject<DiscoveredDevice[]>();
        deps.dmk.listenToAvailableDevices.mockReturnValue(availableDevices);
        const service = createLedgerBitcoinService(deps);
        const onDevices = jest.fn();

        service.listenToAvailableDevices(onDevices, jest.fn());
        await service.disconnect();
        availableDevices.next([device]);

        expect(onDevices).not.toHaveBeenCalled();
    });

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
            extendedPublicKey,
            descriptor,
            masterFingerprint: '5c9e228d',
            address: firstAddress,
        });
        expect(deps.dmk.connect).toHaveBeenCalledWith({ device });
        expect(deps.createSigner).toHaveBeenCalledWith('session-1');
        expect(deps.createSigner.mock.results[0]?.value.getWalletAddress).toHaveBeenCalledWith(
            expect.objectContaining({ derivationPath: "84'/0'/0'" }),
            0,
        );
    });

    it('exposes the stable Bitcoin master fingerprint', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);

        await expect(service.getMasterFingerprint()).resolves.toBe('5c9e228d');
    });

    it('rejects an account when the signer address differs from the descriptor address', async () => {
        const deps = createDeps('bc1qwrong');
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);

        await expect(service.getAccount(0)).rejects.toThrow(
            'Ledger account public key does not match its first address',
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
        await expect(service.verifyAddress(0, 0)).resolves.toBe(firstAddress);

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

    it('returns unprefixed serialized transaction hex from the Bitcoin signer', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect(device);
        await expect(service.signTransaction(0, 'cHNidA==')).resolves.toBe('02000000');

        expect(deps.createSigner.mock.results[0]?.value.signTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ derivationPath: "84'/0'/0'" }),
            'cHNidA==',
        );
    });

    it('rejects malformed serialized transaction hex from the Bitcoin signer', async () => {
        const service = createLedgerBitcoinService(createDeps(firstAddress, '0x1'));

        await service.connect(device);

        await expect(service.signTransaction(0, 'cHNidA==')).rejects.toThrow(
            'Ledger returned an invalid serialized Bitcoin transaction',
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
