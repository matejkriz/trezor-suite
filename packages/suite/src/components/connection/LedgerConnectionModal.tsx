import { useEffect, useRef, useState } from 'react';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedDevice } from '@suite-common/device';
import { type LedgerDevice, injectLedgerBitcoinService } from '@suite-common/ledger';
import { injectDispatch } from '@suite-common/redux-utils';
import { connectLedgerBitcoinWalletThunk } from '@suite-common/wallet-core';
import { Button, Column, H3, Modal, Row, Spinner, Text } from '@trezor/components';

import { redirectAfterWalletSelectedThunk } from 'src/actions/wallet/addWalletThunk';
import { useSelector } from 'src/hooks/suite';

import { LedgerConnectionIllustration } from './LedgerConnectionIllustration';
import { getLedgerConnectionErrorMessage } from './getLedgerConnectionErrorMessage';

type LedgerConnectionModalProps = {
    onCancel: () => void;
    onBack: () => void;
};

export const LedgerConnectionModal = ({ onCancel, onBack }: LedgerConnectionModalProps) => {
    const { ledgerBitcoinService, dispatch } = useServices(
        injectLedgerBitcoinService,
        injectDispatch,
    );
    const selectedDevice = useSelector(selectSelectedDevice);
    const [devices, setDevices] = useState<LedgerDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const isActive = useRef(true);
    const abortConnection = useRef<(() => void) | undefined>(undefined);
    const stopScanning = useRef<(() => Promise<void>) | undefined>(undefined);
    const isWebHIDAvailable =
        typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;

    useEffect(() => {
        isActive.current = true;
        const stopListening = ledgerBitcoinService.listenToAvailableDevices(
            availableDevices => setDevices(availableDevices),
            error => setErrorMessage(getLedgerConnectionErrorMessage(error)),
        );

        return () => {
            isActive.current = false;
            abortConnection.current?.();
            stopListening();
            void stopScanning.current?.().catch(() => undefined);
        };
    }, [ledgerBitcoinService]);

    const startScanning = () => {
        setDevices([]);
        setErrorMessage(undefined);
        setIsScanning(true);

        try {
            stopScanning.current = ledgerBitcoinService.startDiscovery(
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
        if (abortConnection.current) return;

        setIsBusy(true);
        setErrorMessage(undefined);
        const connection = dispatch(connectLedgerBitcoinWalletThunk({ device }));
        abortConnection.current = connection.abort;

        try {
            const connectedDevice = await connection.unwrap();
            abortConnection.current = undefined;
            if (!isActive.current) return;

            onCancel();
            if (selectedDevice?.id !== connectedDevice.id) {
                dispatch(redirectAfterWalletSelectedThunk({ forceDeviceDashboard: true }));
            }
        } catch (error) {
            if (isActive.current) setErrorMessage(getLedgerConnectionErrorMessage(error));
        } finally {
            abortConnection.current = undefined;
            if (isActive.current) {
                setIsScanning(false);
                setIsBusy(false);
            }
        }
    };

    return (
        <Modal.Backdrop onClick={onCancel}>
            <Modal.ModalBase
                data-testid="@suite/ledger-connection-modal"
                width={400}
                onCancel={onCancel}
                onBackClick={onBack}
                bottomContent={
                    <Column width="100%">
                        <Button
                            onClick={startScanning}
                            isDisabled={!isWebHIDAvailable || isScanning || isBusy}
                        >
                            Choose Ledger
                        </Button>
                    </Column>
                }
            >
                <Column alignItems="center" gap={24} overflow="hidden">
                    <H3 typographyStyle="headline-md" align="center" textWrap="balance">
                        Connect &amp; unlock your Ledger
                    </H3>
                    <Row gap={8} alignItems="center" justifyContent="center" height={36}>
                        {(isScanning || isBusy) && <Spinner size={16} />}
                        <Text intent="brand">Checking for connected Ledgers</Text>
                    </Row>
                    <LedgerConnectionIllustration />
                    <Text align="center">
                        Connect your Ledger by USB and unlock it. Confirm opening the Bitcoin app
                        when prompted.
                    </Text>
                    <Column gap={12} width="100%">
                        {!isWebHIDAvailable && (
                            <Text intent="critical">
                                USB connection to Ledger requires WebHID. Open Suite in Chrome or
                                Edge, or use the desktop app.
                            </Text>
                        )}
                        {isScanning && devices.length === 0 && (
                            <Text>Choose your Ledger in the browser&apos;s USB device picker.</Text>
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
                    </Column>
                    {errorMessage && <Text intent="critical">{errorMessage}</Text>}
                </Column>
            </Modal.ModalBase>
        </Modal.Backdrop>
    );
};
