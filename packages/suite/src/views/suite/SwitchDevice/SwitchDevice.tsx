import { events, injectDesktopAnalytics } from '@suite/analytics';
import { openConnectionModal, setConnectionMode, toggleConnectionModal } from '@suite/device';
import { Translation } from '@suite/intl';
import { bluetoothActions, selectAdapterStatus } from '@suite-common/bluetooth';
import { useServices } from '@suite-common/dependency-injection';
import { selectDevices, selectExternalWallets } from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import * as deviceUtils from '@suite-common/suite-utils';
import { Button, Column } from '@trezor/components';
import { CableUsbCIcon, TrezorDevicesIcon } from '@trezor/icons';

import { useSelector } from 'src/hooks/suite';
import { type ForegroundAppProps } from 'src/types/suite';

import { DeviceItem } from './DeviceItem/DeviceItem';
import { ExternalWalletItem } from './ExternalWalletItem';
import { SwitchDeviceModal } from './SwitchDeviceModal';

export const SwitchDeviceContent = ({ cancelable, onCancel }: ForegroundAppProps) => {
    const { analytics, dispatch } = useServices(injectDesktopAnalytics, injectDispatch);
    const bluetoothAdapterStatus = useSelector(selectAdapterStatus);
    const devices = useSelector(selectDevices);
    const externalWallets = useSelector(selectExternalWallets);

    // exclude selectedDevice from list, because other devices could have a higher priority,
    // and we want to have selectedDevice on top
    const sortedDevices = deviceUtils.getFirstDeviceInstance(devices, {
        sortingFn: deviceUtils.sortDevicesForDeviceList,
    });

    const openDeviceConnectionModal = () => {
        dispatch(toggleConnectionModal());

        if (bluetoothAdapterStatus === 'enabled') {
            dispatch(bluetoothActions.enableAutoConnect());
            dispatch(setConnectionMode('bluetooth'));
        }

        analytics.report({
            type: events.deviceConnectionConnectButtonEvent.name,
            payload: {
                option: 'dropdown',
            },
        });

        onCancel();
    };

    const openLedgerConnectionModal = () => {
        dispatch(openConnectionModal('ledger'));
        onCancel();
    };

    return (
        <Column gap={12}>
            {sortedDevices.map(device => (
                <DeviceItem
                    key={`${device.path}-${device.id}-${device.instance}`}
                    device={device}
                    instances={deviceUtils.getDeviceInstances(device, devices)}
                    onCancel={cancelable ? onCancel : undefined}
                />
            ))}
            {externalWallets.map(wallet => (
                <ExternalWalletItem key={wallet.id} wallet={wallet} onCancel={onCancel} />
            ))}
            <Button
                intent="neutral"
                priority="secondary"
                iconLeft={TrezorDevicesIcon}
                isFloating
                width="100%"
                size="large"
                onClick={openDeviceConnectionModal}
            >
                <Translation id="TR_CONNECT_DEVICE" />
            </Button>
            <Button
                intent="neutral"
                priority="secondary"
                iconLeft={CableUsbCIcon}
                isFloating
                width="100%"
                size="large"
                onClick={openLedgerConnectionModal}
            >
                Connect Ledger
            </Button>
        </Column>
    );
};

export const SwitchDevice = ({ cancelable, onCancel }: ForegroundAppProps) => (
    <SwitchDeviceModal isAnimationEnabled onCancel={cancelable ? onCancel : undefined}>
        <SwitchDeviceContent cancelable={cancelable} onCancel={onCancel} />
    </SwitchDeviceModal>
);
