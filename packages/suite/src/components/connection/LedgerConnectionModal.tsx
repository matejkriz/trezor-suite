import { useEffect, useState } from 'react';

import { useServices } from '@suite-common/dependency-injection';
import { selectSelectedExternalWallet } from '@suite-common/device';
import { type LedgerDevice } from '@suite-common/ledger';
import { injectDispatch } from '@suite-common/redux-utils';
import { selectAccounts } from '@suite-common/wallet-core';
import { Button, Column, H3, Modal, Row, Spinner, Text } from '@trezor/components';
import TrezorConnect from '@trezor/connect';

import { addDiscoveredLedgerBitcoinWallet } from 'src/actions/ledger/addDiscoveredLedgerBitcoinWallet';
import { discoverLedgerBitcoinWallet } from 'src/actions/ledger/discoverLedgerBitcoinWallet';
import { redirectAfterWalletSelectedThunk } from 'src/actions/wallet/addWalletThunk';
import { useSelector } from 'src/hooks/suite';
import { injectLedgerBitcoinService } from 'src/support/ledger/injectLedgerBitcoinService';

import { LedgerConnectionIllustration } from './LedgerConnectionIllustration';
import { getLedgerConnectionErrorMessage } from './getLedgerConnectionErrorMessage';

type LedgerConnectionModalProps = {
    onCancel: () => void;
    onBack: () => void;
};

export const LedgerConnectionModal = ({ onCancel, onBack }: LedgerConnectionModalProps) => {
    const { ledgerBitcoinService: service, dispatch } = useServices(
        injectLedgerBitcoinService,
        injectDispatch,
    );
    const selectedExternalWallet = useSelector(selectSelectedExternalWallet);
    const existingAccounts = useSelector(selectAccounts);
    const [devices, setDevices] = useState<LedgerDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const isWebHIDAvailable =
        typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;

    useEffect(() => {
        const stopListening = service.listenToAvailableDevices(
            availableDevices => setDevices(availableDevices),
            error => setErrorMessage(getLedgerConnectionErrorMessage(error)),
        );

        return () => {
            stopListening();
            void service.stopDiscovery().catch(() => undefined);
        };
    }, [service]);

    const startScanning = () => {
        setDevices([]);
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
            const discovered = await discoverLedgerBitcoinWallet(
                {
                    ledgerBitcoinService: service,
                    getAccountInfo: descriptor =>
                        TrezorConnect.getAccountInfo({
                            coin: 'btc',
                            descriptor,
                            details: 'txs',
                            page: 1,
                            pageSize: 25,
                            suppressBackupWarning: true,
                        }),
                },
                device,
            );
            addDiscoveredLedgerBitcoinWallet(dispatch, existingAccounts, discovered);
            onCancel();
            if (selectedExternalWallet?.id !== discovered.wallet.id) {
                dispatch(redirectAfterWalletSelectedThunk({ forceDeviceDashboard: true }));
            }
        } catch (error) {
            setErrorMessage(getLedgerConnectionErrorMessage(error));
        } finally {
            setIsScanning(false);
            setIsBusy(false);
        }
    };

    return (
        <Modal.Backdrop onClick={onCancel}>
            <Modal.ModalBase
                data-testid="@suite/ledger-connection-modal"
                width={400}
                onCancel={onCancel}
                onBackClick={onBack}
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
                        Connect your Ledger by USB, unlock it, and open the Bitcoin app.
                    </Text>
                    <Column gap={12} width="100%">
                        <Button
                            onClick={startScanning}
                            isDisabled={!isWebHIDAvailable || isScanning || isBusy}
                        >
                            Choose Ledger
                        </Button>
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
