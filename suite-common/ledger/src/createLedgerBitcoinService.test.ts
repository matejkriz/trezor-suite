import {
    DeviceActionStatus,
    DeviceModel,
    DeviceModelId,
    type DeviceSessionState,
    DeviceSessionStateType,
    DeviceStatus,
    type DiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {
    type GetExtendedPublicKeyDAReturnType,
    type GetWalletAddressDAState,
    type SignerBtc,
} from '@ledgerhq/device-signer-kit-bitcoin';
import { EMPTY, NEVER, type ObservedValueOf, Subject, of, throwError } from 'rxjs';

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
            sendApdu: () =>
                Promise.resolve({
                    data: Buffer.from('My Ledger'),
                    statusCode: Uint8Array.of(0x90, 0x00),
                }),
            startDiscovering: () => of(device),
            listenToAvailableDevices: () => of([device]),
            stopDiscovering: () => Promise.resolve(),
            connect: () => Promise.resolve('session-1'),
            getDeviceSessionState: () => NEVER,
            disconnect: () => Promise.resolve(),
            close: () => undefined,
        },
        goToDashboard: () => ({
            observable: of({ status: DeviceActionStatus.Completed, output: undefined }),
            cancel: jest.fn(),
        }),
        openAccountsDiscoveryApp: () => ({
            observable: of({ status: DeviceActionStatus.Completed, output: undefined }),
            cancel: jest.fn(),
        }),
        createSigner: () => signer,
        onDisconnect: jest.fn(),
    });
};

describe('createLedgerBitcoinService', () => {
    it('opens multi-network discovery without using the Bitcoin signer', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);
        await service.connect(device);
        deps.dmk.sendApdu
            .mockResolvedValueOnce({
                data: Uint8Array.from([65, 68, 1, 0, 1, 0, 1, 3, 2, 3, 15]),
                statusCode: Uint8Array.from([0x90, 0]),
            })
            .mockResolvedValueOnce({
                data: new Uint8Array(),
                statusCode: Uint8Array.from([0x90, 0]),
            });

        const discovery = await service.openAccountsDiscovery();

        expect((await discovery.getInfo()).profiles).toEqual([3, 15]);
        expect(deps.openAccountsDiscoveryApp).toHaveBeenCalledWith('session-1');
        expect(
            deps.createSigner.mock.results[0]?.value.getExtendedPublicKey,
        ).not.toHaveBeenCalled();
        await service.disconnect();
        await expect(discovery.readPublicKeys([{ profile: 3, account: 0 }])).rejects.toThrow(
            'connection',
        );
    });
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
            deviceName: 'Ledger Nano S Plus',
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

    it('derives accounts in Speculos without requiring an OS dashboard', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);

        await service.connect({ ...device, transport: 'SPECULOS_HTTP_TRANSPORT' });
        await expect(service.getAccount(0)).resolves.toMatchObject({ descriptor });
        expect(deps.goToDashboard).not.toHaveBeenCalled();
        expect(deps.dmk.sendApdu).not.toHaveBeenCalled();
    });

    it('does not revive an aborted connection when DMK resolves it after a newer connection', async () => {
        const deps = createDeps();
        let finishOldConnection: (session: string) => void = () => undefined;
        let markConnecting: () => void = () => undefined;
        const connectingStarted = new Promise<void>(resolve => {
            markConnecting = resolve;
        });
        deps.dmk.connect.mockImplementationOnce(() => {
            markConnecting();

            return new Promise(resolve => {
                finishOldConnection = resolve;
            });
        });
        deps.dmk.connect.mockResolvedValueOnce('new-session');
        const service = createLedgerBitcoinService(deps);
        const oldConnection = service.connect(device);
        await connectingStarted;
        const disconnecting = service.disconnect();
        const newConnection = service.connect(device);

        finishOldConnection('old-session');
        await expect(oldConnection).rejects.toThrow('Ledger connection canceled');
        await disconnecting;
        await newConnection;
        expect(deps.dmk.disconnect).toHaveBeenCalledWith({ sessionId: 'old-session' });
        expect(deps.dmk.disconnect).not.toHaveBeenCalledWith({ sessionId: 'new-session' });
        await expect(service.getAccount(0)).resolves.toMatchObject({ descriptor });
    });

    it('cancels the active signer action without disconnecting the session', async () => {
        const deps = createDeps();
        const actionState = new Subject<GetWalletAddressDAState>();
        const cancel = jest.fn(() => actionState.next({ status: DeviceActionStatus.Stopped }));
        const signer = deps.createSigner('session-1');
        jest.mocked(signer.getWalletAddress).mockReturnValue({ observable: actionState, cancel });
        const service = createLedgerBitcoinService(deps);
        await service.connect(device);

        const verification = service.verifyAddress(0, 0);
        service.cancelAction();
        await expect(verification).rejects.toMatchObject({ kind: 'cancelled' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(deps.dmk.disconnect).not.toHaveBeenCalled();
    });

    it('keeps the newer acquisition when the old owner settles or cancels late', async () => {
        const deps = createDeps();
        let finishOldConnection: (session: string) => void = () => undefined;
        let markConnecting: () => void = () => undefined;
        const connectingStarted = new Promise<void>(resolve => {
            markConnecting = resolve;
        });
        deps.dmk.connect.mockImplementationOnce(() => {
            markConnecting();

            return new Promise(resolve => {
                finishOldConnection = resolve;
            });
        });
        deps.dmk.connect.mockResolvedValueOnce('new-session');
        const service = createLedgerBitcoinService(deps);
        const oldConnection = service.connect(device, { owner: 'old-owner' });
        await connectingStarted;
        const newConnection = service.connect(device, { owner: 'new-owner' });

        finishOldConnection('old-session');
        await expect(oldConnection).rejects.toThrow('Ledger connection canceled');
        await newConnection;
        await service.disconnect({ owner: 'old-owner' });

        expect(deps.dmk.disconnect).not.toHaveBeenCalledWith({ sessionId: 'new-session' });
        expect(service.isConnectionOwner('new-owner')).toBe(true);
        await expect(service.getAccount(0)).resolves.toMatchObject({ descriptor });
    });

    it('cleans an obsolete same-device session before reconnecting its shared physical link', async () => {
        const deps = createDeps();
        let finishOldConnection: () => void = () => undefined;
        let markConnecting: () => void = () => undefined;
        const connectingStarted = new Promise<void>(resolve => {
            markConnecting = resolve;
        });
        const events: string[] = [];
        const physicalSessions = new Set<string>();
        deps.dmk.connect.mockImplementationOnce(() => {
            markConnecting();

            return new Promise<string>(resolve => {
                finishOldConnection = () => {
                    physicalSessions.add('old-session');
                    events.push('connect-old');
                    resolve('old-session');
                };
            });
        });
        deps.dmk.connect.mockImplementationOnce(() => {
            physicalSessions.add('new-session');
            events.push('connect-new');

            return Promise.resolve('new-session');
        });
        deps.dmk.disconnect.mockImplementation(({ sessionId }) => {
            events.push(`disconnect-${sessionId}`);
            physicalSessions.clear();

            return Promise.resolve();
        });
        const service = createLedgerBitcoinService(deps);
        const oldConnection = service.connect(device, { owner: 'old-owner' });
        const oldResult = oldConnection.catch((error: unknown) => error);
        await connectingStarted;
        const newConnection = service.connect(device, { owner: 'new-owner' });
        await Promise.resolve();
        finishOldConnection();
        await expect(oldResult).resolves.toMatchObject({ message: 'Ledger connection canceled' });
        await newConnection;

        expect(physicalSessions.has('new-session')).toBe(true);
        expect(events).toEqual(['connect-old', 'disconnect-old-session', 'connect-new']);
        expect(service.isConnectionOwner('new-owner')).toBe(true);
    });

    it('invalidates acquisition ownership when the current session naturally disconnects', async () => {
        const deps = createDeps();
        const sessionState = new Subject<DeviceSessionState>();
        deps.dmk.getDeviceSessionState.mockReturnValue(sessionState);
        const service = createLedgerBitcoinService(deps);
        await service.connect(device, { owner: 'acquisition' });
        expect(service.isConnectionOwner('acquisition')).toBe(true);

        sessionState.next({ deviceStatus: DeviceStatus.NOT_CONNECTED } as DeviceSessionState);

        expect(service.isConnectionOwner('acquisition')).toBe(false);
    });

    it('allows replacement while an obsolete dashboard action has not settled', async () => {
        const deps = createDeps();
        const dashboardState = new Subject<
            ObservedValueOf<ReturnType<LedgerBitcoinServiceDeps['goToDashboard']>['observable']>
        >();
        let markDashboardRequested: () => void = () => undefined;
        const dashboardRequested = new Promise<void>(resolve => {
            markDashboardRequested = resolve;
        });
        const cancelDashboard = jest.fn();
        deps.goToDashboard.mockImplementationOnce(() => {
            markDashboardRequested();

            return { observable: dashboardState, cancel: cancelDashboard };
        });
        const service = createLedgerBitcoinService(deps);
        const oldConnection = service.connect(device, { owner: 'old-owner' });
        const oldResult = oldConnection.catch((error: unknown) => error);
        await dashboardRequested;

        await service.connect(device, { owner: 'new-owner' });

        expect(cancelDashboard).toHaveBeenCalledTimes(1);
        expect(service.isConnectionOwner('new-owner')).toBe(true);
        dashboardState.next({ status: DeviceActionStatus.Stopped });
        await expect(oldResult).resolves.toMatchObject({ kind: 'cancelled' });
    });

    it('does not continue old account work against a replacement connection', async () => {
        const deps = createDeps();
        const actionState = new Subject<
            ObservedValueOf<GetExtendedPublicKeyDAReturnType['observable']>
        >();
        const signer = deps.createSigner('session-1');
        jest.mocked(signer.getExtendedPublicKey).mockReturnValueOnce({
            observable: actionState,
            cancel: jest.fn(),
        });
        const service = createLedgerBitcoinService(deps);
        await service.connect(device);
        const oldAccount = service.getAccount(0);
        await service.connect(device);

        actionState.next({ status: DeviceActionStatus.Completed, output: { extendedPublicKey } });

        await expect(oldAccount).rejects.toMatchObject({ kind: 'cancelled' });
        expect(signer.getWalletAddress).not.toHaveBeenCalled();
        expect(signer.getMasterFingerprint).not.toHaveBeenCalled();
    });

    it('preserves a caller timeout while stopping the SDK action', async () => {
        const deps = createDeps();
        const actionState = new Subject<GetWalletAddressDAState>();
        const cancel = jest.fn(() => actionState.next({ status: DeviceActionStatus.Stopped }));
        const signer = deps.createSigner('session-1');
        jest.mocked(signer.getWalletAddress).mockReturnValue({ observable: actionState, cancel });
        const service = createLedgerBitcoinService(deps);
        await service.connect(device);

        const verification = service.verifyAddress(0, 0);
        service.cancelAction('timeout');
        await expect(verification).rejects.toMatchObject({ kind: 'timeout' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(deps.dmk.disconnect).not.toHaveBeenCalled();
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

    it('stops the underlying available-device scan after its listener unsubscribes', async () => {
        const deps = createDeps();
        const service = createLedgerBitcoinService(deps);
        const stopListening = service.listenToAvailableDevices(jest.fn(), jest.fn());
        stopListening();

        await service.stopDiscovery();
        await service.stopDiscovery();

        expect(deps.dmk.stopDiscovering).toHaveBeenCalledTimes(1);
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

    it('stops its underlying scan after the observable fails without stopping an unowned scan', async () => {
        const deps = createDeps();
        deps.dmk.startDiscovering.mockReturnValueOnce(throwError(() => new Error('Scan failed')));
        const service = createLedgerBitcoinService(deps);
        await service.stopDiscovery();
        expect(deps.dmk.stopDiscovering).not.toHaveBeenCalled();

        service.startDiscovery(jest.fn(), jest.fn());
        await service.stopDiscovery();
        await service.stopDiscovery();

        expect(deps.dmk.stopDiscovering).toHaveBeenCalledTimes(1);
    });

    it('does not stop a newer scan when the previous screen releases its handle', async () => {
        const deps = createDeps();
        const firstScan = new Subject<DiscoveredDevice>();
        const secondScan = new Subject<DiscoveredDevice>();
        deps.dmk.startDiscovering.mockReturnValueOnce(firstScan).mockReturnValueOnce(secondScan);
        const service = createLedgerBitcoinService(deps);
        const onFirstDevice = jest.fn();
        const onSecondDevice = jest.fn();
        const stopFirst = service.startDiscovery(onFirstDevice, jest.fn());
        const stopSecond = service.startDiscovery(onSecondDevice, jest.fn());

        await stopFirst();
        secondScan.next(device);

        expect(onSecondDevice).toHaveBeenCalledWith(device);
        expect(onFirstDevice).not.toHaveBeenCalled();
        expect(deps.dmk.stopDiscovering).not.toHaveBeenCalled();
        await stopSecond();
        expect(deps.dmk.stopDiscovering).toHaveBeenCalledTimes(1);
    });
});
