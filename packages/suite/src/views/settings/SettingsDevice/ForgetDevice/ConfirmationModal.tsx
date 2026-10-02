import { Translation } from '@suite/intl';
import { selectDeviceBrandName } from '@suite-common/device';
import { Card, Icon, List, Modal, Paragraph } from '@trezor/components';
import { BluetoothSlashIcon, LinkBreakIcon, ScrollIcon } from '@trezor/icons';

import { useSelector } from 'src/hooks/suite';

type ConfirmationContentProps = {
    isBluetoothDevice: boolean;
    isBluetoothConnectedDevice: boolean;
    deviceBrand: string;
};

const ConfirmationContent = ({
    isBluetoothDevice,
    isBluetoothConnectedDevice,
    deviceBrand,
}: ConfirmationContentProps) => (
    <Card paddingType="normal" data-testid="@settings/device/forget/confirm-content">
        <List gap={24}>
            <List.Item
                bulletComponent={
                    <Icon as={LinkBreakIcon} intent="neutral" priority="secondary" size={20} />
                }
            >
                <Paragraph intent="neutral" priority="secondary">
                    <Translation id="TR_FORGET_PROVIDER_DEVICE_BULLET" values={{ deviceBrand }} />
                </Paragraph>
            </List.Item>
            {isBluetoothDevice && (
                <List.Item
                    bulletComponent={
                        <Icon
                            as={BluetoothSlashIcon}
                            intent="neutral"
                            priority="secondary"
                            size={20}
                        />
                    }
                >
                    <Paragraph intent="neutral" priority="secondary">
                        {isBluetoothConnectedDevice ? (
                            <Translation id="TR_FORGET_DEVICE_MODAL_BLUETOOTH_REMOVED_AND_DISCONNECTED" />
                        ) : (
                            <Translation id="TR_FORGET_DEVICE_MODAL_BLUETOOTH_REMOVED" />
                        )}
                    </Paragraph>
                </List.Item>
            )}
            <List.Item
                bulletComponent={
                    <Icon as={ScrollIcon} intent="neutral" priority="secondary" size={20} />
                }
            >
                <Paragraph intent="neutral" priority="secondary">
                    <Translation id="TR_FORGET_DEVICE_MODAL_BULLET_NOT_WIPE" />
                </Paragraph>
            </List.Item>
        </List>
    </Card>
);

type ConfirmationModalProps = {
    onConfirm: () => void;
    onCancel: () => void;
    isBluetoothDevice: boolean;
    isBluetoothConnectedDevice: boolean;
};

export const ConfirmationModal = ({
    onConfirm,
    onCancel,
    isBluetoothDevice,
    isBluetoothConnectedDevice,
}: ConfirmationModalProps) => {
    const deviceBrand = useSelector(selectDeviceBrandName);

    return (
        <Modal
            onCancel={onCancel}
            heading={
                <Translation id="TR_FORGET_PROVIDER_DEVICE_HEADING" values={{ deviceBrand }} />
            }
            intent="warning"
            width={680}
            bottomContent={
                <>
                    <Modal.Button
                        data-testid="@settings/device/forget-button-confirm"
                        onClick={onConfirm}
                    >
                        <Translation id="TR_FORGET_DEVICE_MODAL_CONFIRM" />
                    </Modal.Button>
                    <Modal.Button
                        data-testid="@settings/device/forget-button-cancel"
                        intent="neutral"
                        priority="secondary"
                        onClick={onCancel}
                    >
                        <Translation id="TR_CANCEL" />
                    </Modal.Button>
                </>
            }
        >
            <ConfirmationContent
                isBluetoothDevice={isBluetoothDevice}
                isBluetoothConnectedDevice={isBluetoothConnectedDevice}
                deviceBrand={deviceBrand}
            />
        </Modal>
    );
};
