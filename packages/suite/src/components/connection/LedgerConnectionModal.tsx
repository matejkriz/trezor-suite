import { useEffect, useState } from 'react';

import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid';

import { type LedgerDevice, createLedgerBitcoinServiceForTransport } from '@suite-common/ledger';
import { Button, Column, H3, Modal, Row, Spinner, Text } from '@trezor/components';

import { getLedgerConnectionErrorMessage } from './getLedgerConnectionErrorMessage';

type LedgerConnectionModalProps = {
    onCancel: () => void;
    onBack: () => void;
};

export const LedgerConnectionModal = ({ onCancel, onBack }: LedgerConnectionModalProps) => {
    const [service] = useState(() =>
        createLedgerBitcoinServiceForTransport(webHidTransportFactory),
    );
    const [devices, setDevices] = useState<LedgerDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [address, setAddress] = useState<string>();
    const [isAddressVerified, setIsAddressVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const isWebHIDAvailable =
        typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;

    useEffect(
        () => () => {
            void service.dispose().catch(() => undefined);
        },
        [service],
    );

    const startScanning = () => {
        setDevices([]);
        setAddress(undefined);
        setErrorMessage(undefined);
        setIsScanning(true);

        try {
            service.startDiscovery(
                device => {
                    setIsScanning(false);
                    setDevices(current =>
                        current.some(knownDevice => knownDevice.id === device.id)
                            ? current
                            : [...current, device],
                    );
                },
                error => {
                    setIsScanning(false);
                    setErrorMessage(getLedgerConnectionErrorMessage(error));
                },
            );
        } catch (error) {
            setIsScanning(false);
            setErrorMessage(getLedgerConnectionErrorMessage(error));
        }
    };

    const connect = async (device: LedgerDevice) => {
        setIsBusy(true);
        setErrorMessage(undefined);

        try {
            await service.connect(device);
            const account = await service.getAccount(0);
            setAddress(account.address);
        } catch (error) {
            setErrorMessage(getLedgerConnectionErrorMessage(error));
        } finally {
            setIsScanning(false);
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
            setErrorMessage(getLedgerConnectionErrorMessage(error));
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <Modal
            data-testid="@suite/ledger-connection-modal"
            heading="Connect Ledger"
            description="Connect your Ledger by USB, unlock it, and open the Bitcoin app."
            width={480}
            onCancel={onCancel}
            onBackClick={onBack}
        >
            <Column gap={16}>
                {address ? (
                    <>
                        <H3>First Bitcoin receiving address</H3>
                        <Text>Native SegWit · m/84&apos;/0&apos;/0&apos;</Text>
                        <Text>{address}</Text>
                        <Text>Account history and sending are not available in this preview.</Text>
                        <Button onClick={verifyAddress} isDisabled={isBusy || isAddressVerified}>
                            {isAddressVerified
                                ? 'Address verified on Ledger'
                                : 'Verify address on Ledger'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={startScanning}
                            isDisabled={!isWebHIDAvailable || isScanning || isBusy}
                        >
                            Scan for Ledger devices
                        </Button>
                        {!isWebHIDAvailable && (
                            <Text intent="critical">
                                USB connection to Ledger requires WebHID. Open Suite in Chrome or
                                Edge, or use the desktop app.
                            </Text>
                        )}
                        {isScanning && devices.length === 0 && (
                            <Row gap={8} alignItems="center">
                                <Spinner size={16} />
                                <Text>
                                    Choose your Ledger in the browser&apos;s USB device picker.
                                </Text>
                            </Row>
                        )}
                        {devices.map(device => (
                            <Button
                                key={device.id}
                                onClick={() => void connect(device)}
                                isDisabled={isBusy}
                                priority="secondary"
                            >
                                {device.name}
                            </Button>
                        ))}
                    </>
                )}
                {errorMessage && <Text intent="critical">{errorMessage}</Text>}
            </Column>
        </Modal>
    );
};
