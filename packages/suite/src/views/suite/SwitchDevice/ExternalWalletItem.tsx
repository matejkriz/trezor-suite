import { useServices } from '@suite-common/dependency-injection';
import {
    type ExternalWallet,
    deviceActions,
    selectSelectedExternalWallet,
} from '@suite-common/device';
import { injectDispatch } from '@suite-common/redux-utils';
import { Box, Card, Icon, Row, Text } from '@trezor/components';
import { CableUsbCIcon } from '@trezor/icons';

import { redirectAfterWalletSelectedThunk } from 'src/actions/wallet/addWalletThunk';
import { useSelector } from 'src/hooks/suite';

type ExternalWalletItemProps = {
    wallet: ExternalWallet;
    onCancel: () => void;
};

export const ExternalWalletItem = ({ wallet, onCancel }: ExternalWalletItemProps) => {
    const { dispatch } = useServices(injectDispatch);
    const selectedWallet = useSelector(selectSelectedExternalWallet);

    const selectWallet = () => {
        dispatch(deviceActions.selectExternalWallet(wallet.id));
        dispatch(redirectAfterWalletSelectedThunk({ forceDeviceDashboard: true }));
        onCancel();
    };

    return (
        <Card
            paddingType="none"
            onClick={selectWallet}
            tabIndex={0}
            isSelected={selectedWallet?.id === wallet.id}
            data-testid="@switch-device/ledger-wallet"
        >
            <Box padding={{ vertical: 16, horizontal: 16 }}>
                <Row gap={12} alignItems="center">
                    <Icon as={CableUsbCIcon} size={24} />
                    <Text typographyStyle="body-md-strong">{wallet.label}</Text>
                    {!wallet.connected && <Text intent="neutral">Disconnected</Text>}
                </Row>
            </Box>
        </Card>
    );
};
