import { events, injectDesktopAnalytics } from '@suite/analytics';
import { openConnectionModal, toggleConnectionModal } from '@suite/device';
import { Translation } from '@suite/intl';
import { selectHasExperimentalFeature } from '@suite/settings';
import { useServices } from '@suite-common/dependency-injection';
import { injectDispatch } from '@suite-common/redux-utils';
import { Button, Column } from '@trezor/components';

import { useSelector } from 'src/hooks/suite';

export const DeviceConnect = () => {
    const { analytics, dispatch } = useServices(injectDesktopAnalytics, injectDispatch);
    const isLedgerEnabled = useSelector(selectHasExperimentalFeature('ledger'));

    const handleConnect = () => {
        dispatch(toggleConnectionModal());
        analytics.report({
            type: events.deviceConnectionConnectButtonEvent.name,
            payload: {
                option: 'dashboard',
            },
        });
    };

    return (
        <Column alignItems="center" gap={12} margin={{ bottom: 40 }}>
            <Button minWidth={240} size="large" onClick={handleConnect}>
                <Translation id="TR_CONNECT" />
            </Button>
            {isLedgerEnabled && (
                <Button
                    minWidth={240}
                    size="large"
                    priority="secondary"
                    onClick={() => dispatch(openConnectionModal('ledger'))}
                >
                    Connect Ledger
                </Button>
            )}
        </Column>
    );
};
