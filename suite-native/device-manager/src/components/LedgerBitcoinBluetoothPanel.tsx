import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import {
    BlePermissionsNotGranted,
    BlePoweredOff,
    PairingRefusedError,
    RNBleTransportFactory,
} from '@ledgerhq/device-transport-kit-react-native-ble';

import { type LedgerDevice, createLedgerBitcoinServiceForTransport } from '@suite-common/ledger';
import { Button, Text, TitleHeader, VStack } from '@suite-native/atoms';
import { selectBluetoothPermissionStatus, useBluetoothPermissions } from '@suite-native/bluetooth';

const getErrorMessage = (error: unknown) => {
    if (error instanceof BlePoweredOff) return 'Turn on Bluetooth to connect your Ledger.';
    if (error instanceof BlePermissionsNotGranted)
        return 'Allow Bluetooth access for Suite in system settings.';
    if (error instanceof PairingRefusedError)
        return 'Pairing was declined. Start a new scan and try again.';
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && '_tag' in error && typeof error._tag === 'string')
        return `Ledger connection failed (${error._tag}).`;

    return 'Ledger connection failed';
};

export const LedgerBitcoinBluetoothPanel = () => {
    const [service] = useState(() =>
        createLedgerBitcoinServiceForTransport(RNBleTransportFactory, 'available'),
    );
    const [devices, setDevices] = useState<LedgerDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [isScanRequested, setIsScanRequested] = useState(false);
    const [address, setAddress] = useState<string>();
    const [isAddressVerified, setIsAddressVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const permissionStatus = useSelector(selectBluetoothPermissionStatus);
    const { requestBluetoothPermission } = useBluetoothPermissions();

    useEffect(
        () => () => {
            void service.dispose().catch(() => undefined);
        },
        [service],
    );

    const startScanning = useCallback(() => {
        setDevices([]);
        setAddress(undefined);
        setErrorMessage(undefined);
        setIsScanning(true);

        try {
            service.startDiscovery(
                device => {
                    setDevices(current =>
                        current.some(knownDevice => knownDevice.id === device.id)
                            ? current
                            : [...current, device],
                    );
                },
                error => {
                    setIsScanning(false);
                    setErrorMessage(getErrorMessage(error));
                },
            );
        } catch (error) {
            setIsScanning(false);
            setErrorMessage(getErrorMessage(error));
        }
    }, [service]);

    useEffect(() => {
        if (isScanRequested && permissionStatus === 'granted') {
            setIsScanRequested(false);
            startScanning();
        }
    }, [isScanRequested, permissionStatus, startScanning]);

    const requestScan = () => {
        if (permissionStatus === 'granted') {
            startScanning();
        } else if (permissionStatus === 'blocked') {
            setErrorMessage('Enable Bluetooth permission for Suite in system settings.');
        } else {
            setIsScanRequested(true);
            requestBluetoothPermission();
        }
    };

    const connect = async (device: LedgerDevice) => {
        setIsBusy(true);
        setErrorMessage(undefined);

        try {
            await service.connect(device);
            const account = await service.getAccount(0);
            setAddress(account.address);
            setIsScanning(false);
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsBusy(false);
        }
    };

    const verifyAddress = async () => {
        if (!address) return;

        setIsBusy(true);
        setErrorMessage(undefined);

        try {
            const verifiedAddress = await service.verifyAddress(0, 0);
            if (verifiedAddress !== address) {
                throw new Error('The address shown by Ledger does not match this address');
            }
            setIsAddressVerified(true);
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <VStack spacing="sp16" paddingHorizontal="sp16" paddingBottom="sp16">
            <TitleHeader
                title="Connect Ledger"
                subtitle="Unlock your Ledger and open the Bitcoin app."
                titleVariant="headline-md"
            />
            {address ? (
                <VStack spacing="sp12">
                    <Text variant="headline-sm">First Bitcoin receiving address</Text>
                    <Text>Native SegWit · m/84&apos;/0&apos;/0&apos;</Text>
                    <Text>{address}</Text>
                    <Text>Account history and sending are not available in this preview.</Text>
                    <Button
                        onPress={() => void verifyAddress()}
                        isDisabled={isBusy || isAddressVerified}
                    >
                        {isAddressVerified
                            ? 'Address verified on Ledger'
                            : 'Verify address on Ledger'}
                    </Button>
                </VStack>
            ) : (
                <VStack spacing="sp12">
                    <Button
                        onPress={requestScan}
                        isDisabled={isScanning || isBusy || permissionStatus === 'requested'}
                    >
                        Scan for Ledger devices
                    </Button>
                    {isScanning && devices.length === 0 && <Text>Scanning via Bluetooth…</Text>}
                    {devices.map(device => (
                        <Button
                            key={device.id}
                            onPress={() => void connect(device)}
                            isDisabled={isBusy}
                            priority="secondary"
                        >
                            {device.name}
                        </Button>
                    ))}
                </VStack>
            )}
            {errorMessage && <Text color="contentCritical">{errorMessage}</Text>}
        </VStack>
    );
};
