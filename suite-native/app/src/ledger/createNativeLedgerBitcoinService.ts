import { type LedgerBitcoinService } from '@suite-common/ledger';

type NativeLedgerBitcoinServiceDeps = {
    createService: () => LedgerBitcoinService;
    suspendDeviceScan: () => Promise<() => void>;
};

type NativeLedgerBitcoinService = LedgerBitcoinService;

export const createNativeLedgerBitcoinService = (
    deps: NativeLedgerBitcoinServiceDeps,
): NativeLedgerBitcoinService => {
    const { createService, suspendDeviceScan } = deps;
    let service: LedgerBitcoinService | undefined;
    let resumeDiscoveryScan: (() => void) | undefined;
    let discoveryRevision = 0;
    let connectionRevision = 0;
    let pendingConnection: { revision: number; owner?: string } | undefined;
    let scanQueue = Promise.resolve();

    const getService = () => (service ??= createService());
    const getConnectedService = () => {
        if (!service) throw new Error('Ledger device is not connected');

        return service;
    };

    const queueScan = <Result>(operation: () => Promise<Result>): Promise<Result> => {
        const result = scanQueue.then(operation);
        scanQueue = result.then(
            () => undefined,
            () => undefined,
        );

        return result;
    };

    const stopOwnedDiscovery = async () => {
        const resume = resumeDiscoveryScan;
        resumeDiscoveryScan = undefined;
        if (!resume) return;

        try {
            await service?.stopDiscovery();
        } finally {
            resume();
        }
    };

    const stopDiscovery = () => {
        discoveryRevision++;

        return queueScan(stopOwnedDiscovery);
    };

    const startScanning = (
        start: (connectedService: LedgerBitcoinService, onError: (error: unknown) => void) => void,
        onError: (error: unknown) => void,
    ) => {
        const revision = ++discoveryRevision;
        const handleError = (error: unknown) => {
            if (revision !== discoveryRevision) return;

            void stopDiscovery().then(
                () => onError(error),
                () => onError(error),
            );
        };

        void queueScan(async () => {
            await stopOwnedDiscovery();
            const resume = await suspendDeviceScan();
            if (revision !== discoveryRevision) {
                resume();

                return;
            }
            resumeDiscoveryScan = resume;
            start(getService(), handleError);
        }).catch(handleError);

        return async () => {
            if (revision === discoveryRevision) await stopDiscovery();
        };
    };

    const isConnectionOwner = (owner: string) =>
        pendingConnection
            ? pendingConnection.owner === owner
            : (service?.isConnectionOwner(owner) ?? false);

    return {
        startDiscovery: (onDevice, onError) =>
            startScanning((connectedService, handleError) => {
                connectedService.startDiscovery(onDevice, handleError);
            }, onError),
        listenToAvailableDevices: (onDevices, onError) => {
            const stop = startScanning((connectedService, handleError) => {
                connectedService.listenToAvailableDevices(onDevices, handleError);
            }, onError);

            return () => {
                void stop();
            };
        },
        stopDiscovery,
        async connect(device, options) {
            const revision = ++connectionRevision;
            pendingConnection = { revision, owner: options?.owner };
            discoveryRevision++;
            const resume = await queueScan(async () => {
                await stopOwnedDiscovery();

                return suspendDeviceScan();
            });

            try {
                if (revision !== connectionRevision) throw new Error('Ledger connection canceled');
                await getService().connect(device, options);
                if (revision !== connectionRevision) throw new Error('Ledger connection canceled');
            } finally {
                if (pendingConnection?.revision === revision) pendingConnection = undefined;
                resume();
            }
        },
        isConnectionOwner,
        async disconnect(options) {
            if (options?.owner && !isConnectionOwner(options.owner)) return;

            const revision = ++connectionRevision;
            pendingConnection = undefined;
            await service?.disconnect(options);
            if (revision === connectionRevision) await stopDiscovery();
        },
        async dispose() {
            connectionRevision++;
            pendingConnection = undefined;
            await service?.dispose();
            await stopDiscovery();
        },
        getDeviceInfo: () => service?.getDeviceInfo(),
        getMasterFingerprint: () => getConnectedService().getMasterFingerprint(),
        getAccount: index => getConnectedService().getAccount(index),
        verifyAddress: (index, addressIndex) =>
            getConnectedService().verifyAddress(index, addressIndex),
        signPsbt: (index, psbt) => getConnectedService().signPsbt(index, psbt),
        signTransaction: (index, psbt) => getConnectedService().signTransaction(index, psbt),
        cancelAction: reason => service?.cancelAction(reason),
    };
};
