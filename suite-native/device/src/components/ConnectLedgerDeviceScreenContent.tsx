import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useSelector } from 'react-redux';

import { useServices } from '@suite-common/dependency-injection';
import { type LedgerDevice, injectLedgerBitcoinService } from '@suite-common/ledger';
import { injectDispatch } from '@suite-common/redux-utils';
import { connectLedgerBitcoinWalletThunk } from '@suite-common/wallet-core';
import { Button, HStack, Loader, Text, VStack } from '@suite-native/atoms';
import { selectBluetoothPermissionStatus, useBluetoothPermissions } from '@suite-native/bluetooth';
import { Translation } from '@suite-native/intl';
import { DeviceModelInternal } from '@trezor/device-utils';

import { DeviceImage } from './DeviceImage';

type ConnectionStatus = 'idle' | 'scanning' | 'connecting';

type ConnectLedgerDeviceScreenContentProps = {
    expectedDeviceId?: string;
    onConnected?: () => void;
};

export const ConnectLedgerDeviceScreenContent = ({
    expectedDeviceId,
    onConnected,
}: ConnectLedgerDeviceScreenContentProps) => {
    const permissionStatus = useSelector(selectBluetoothPermissionStatus);
    const { ledgerBitcoinService, dispatch } = useServices(
        injectLedgerBitcoinService,
        injectDispatch,
    );
    const { requestBluetoothPermission } = useBluetoothPermissions();

    const [devices, setDevices] = useState<LedgerDevice[]>([]);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<'scanError' | 'error'>();
    const [scanAttempt, setScanAttempt] = useState(0);
    const isActive = useRef(true);
    const abortConnection = useRef<(() => void) | undefined>(undefined);
    const stopScanning = useRef<(() => Promise<void>) | undefined>(undefined);
    const hasRequestedPermission = useRef(false);

    useEffect(() => {
        if (permissionStatus !== 'granted') return;

        let isScanActive = true;

        const handleScanError = () => {
            if (!isScanActive || !isActive.current) return;

            setStatus('idle');
            setError('scanError');
        };

        const startScanning = async () => {
            setDevices([]);
            setError(undefined);
            setStatus('scanning');

            try {
                await stopScanning.current?.();
                if (!isScanActive || !isActive.current) return;

                stopScanning.current = ledgerBitcoinService.startDiscovery(device => {
                    if (!isScanActive || !isActive.current) return;

                    setDevices(current => {
                        const existingIndex = current.findIndex(known => known.id === device.id);

                        return existingIndex === -1
                            ? [...current, device]
                            : current.with(existingIndex, device);
                    });
                }, handleScanError);
            } catch {
                handleScanError();
            }
        };

        void startScanning();

        return () => {
            isScanActive = false;
            void stopScanning.current?.().catch(() => undefined);
        };
    }, [ledgerBitcoinService, permissionStatus, scanAttempt]);

    useEffect(() => {
        if (
            permissionStatus !== 'granted' &&
            permissionStatus !== 'blocked' &&
            !hasRequestedPermission.current
        ) {
            hasRequestedPermission.current = true;
            requestBluetoothPermission();
        }
    }, [permissionStatus, requestBluetoothPermission]);

    useEffect(() => {
        isActive.current = true;

        return () => {
            isActive.current = false;
            abortConnection.current?.();
        };
    }, [ledgerBitcoinService]);

    const connect = async (device: LedgerDevice) => {
        if (abortConnection.current) return;

        setStatus('connecting');
        setError(undefined);
        const connection = dispatch(
            connectLedgerBitcoinWalletThunk({
                device,
                apiType: 'bluetooth',
                expectedDeviceId,
            }),
        );
        abortConnection.current = connection.abort;

        try {
            await connection.unwrap();
            abortConnection.current = undefined;

            if (isActive.current) {
                onConnected?.();
            }
        } catch {
            if (isActive.current) {
                setError('error');
                setStatus('idle');
            }
        } finally {
            abortConnection.current = undefined;
        }
    };

    const isConnecting = status === 'connecting';
    const hasPermission = permissionStatus === 'granted';
    const permissionButtonTranslation =
        permissionStatus === 'blocked'
            ? 'moduleConnectLedger.settingsButton'
            : 'moduleConnectLedger.permissionButton';

    const handleRetry = () => {
        if (hasPermission) {
            setScanAttempt(current => current + 1);
        } else if (permissionStatus === 'blocked') {
            void Linking.openSettings();
        } else {
            requestBluetoothPermission();
        }
    };

    return (
        <VStack paddingTop="sp16" spacing="sp32" flex={1} justifyContent="space-between">
            <VStack spacing="sp24" alignItems="center">
                <Text variant="headline-md" textAlign="center">
                    <Translation id="moduleConnectLedger.title" />
                </Text>
                {status !== 'idle' && (
                    <HStack spacing="sp12" alignItems="center">
                        <Loader color="contentBrand" />
                        <Text variant="body-md" color="contentBrand">
                            <Translation
                                id={
                                    isConnecting
                                        ? 'moduleConnectLedger.discovering'
                                        : 'moduleConnectLedger.status'
                                }
                            />
                        </Text>
                    </HStack>
                )}
            </VStack>
            <DeviceImage
                deviceModel={DeviceModelInternal.UNKNOWN}
                deviceImage="ledger"
                size="large"
                maxHeight={280}
            />
            <VStack spacing="sp12">
                <Text color="contentSecondary" textAlign="center">
                    <Translation id="moduleConnectLedger.instructions" />
                </Text>
                {!isConnecting &&
                    devices.map(device => (
                        <Button
                            key={device.id}
                            intent="neutral"
                            priority="secondary"
                            onPress={() => void connect(device)}
                            testID="@connect-ledger/device"
                        >
                            {device.name || device.deviceModel.name}
                        </Button>
                    ))}
                {!!error && (
                    <Text color="contentCritical" textAlign="center">
                        <Translation id={`moduleConnectLedger.${error}`} />
                    </Text>
                )}
                {!hasPermission && (
                    <Text color="contentSecondary" textAlign="center">
                        <Translation
                            id={
                                permissionStatus === 'blocked'
                                    ? 'moduleConnectLedger.blockedPermission'
                                    : 'moduleConnectLedger.permission'
                            }
                        />
                    </Text>
                )}
                {!isConnecting && permissionStatus !== 'requested' && (
                    <Button intent="neutral" priority="secondary" onPress={handleRetry}>
                        <Translation
                            id={
                                hasPermission
                                    ? 'moduleConnectLedger.retry'
                                    : permissionButtonTranslation
                            }
                        />
                    </Button>
                )}
            </VStack>
        </VStack>
    );
};
