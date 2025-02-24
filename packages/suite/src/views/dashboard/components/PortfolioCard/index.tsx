import { memo, useMemo } from 'react';
import styled from 'styled-components';
import { Dropdown, Card } from '@trezor/components';
import {
    GraphScaleDropdownItem,
    GraphSkeleton,
    QuestionTooltip,
    Translation,
} from 'src/components/suite';
import { DashboardSection } from 'src/components/dashboard';
import { useDiscovery, useDispatch, useSelector } from 'src/hooks/suite';
import { useFastAccounts } from 'src/hooks/wallet';
import { goto } from 'src/actions/suite/routerActions';
import { setFlag } from 'src/actions/suite/suiteActions';
import { getTotalFiatBalance } from '@suite-common/wallet-utils';

import { Header } from './components/Header';
import { Exception } from './components/Exception';
import { EmptyWallet } from './components/EmptyWallet';
import { DashboardGraph } from './components/DashboardGraph';
import { selectFiatRates } from '@suite-common/wallet-core';
import { selectLocalCurrency } from 'src/reducers/wallet/settingsReducer';

const Body = styled.div`
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    min-height: 329px;
    flex: 1;
`;

const StyledDropdown = styled(Dropdown)`
    display: flex;
    height: 38px;
`;

const SkeletonTransactionsGraphWrapper = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px 0;
    height: 320px;
`;

const Wrapper = styled.div`
    display: flex;
`;

const PortfolioCard = memo(() => {
    const rates = useSelector(selectFiatRates);
    const localCurrency = useSelector(selectLocalCurrency);
    const { discovery, getDiscoveryStatus, isDiscoveryRunning } = useDiscovery();
    const accounts = useFastAccounts();
    const { dashboardGraphHidden } = useSelector(s => s.suite.flags);
    const dispatch = useDispatch();

    const isDeviceEmpty = useMemo(() => accounts.every(a => a.empty), [accounts]);
    const fiatAmount = getTotalFiatBalance(accounts, localCurrency, rates).toString();

    const discoveryStatus = getDiscoveryStatus();

    // TODO: DashboardGraph will get mounted twice (thus triggering data processing twice)
    // 1. DashboardGraph gets mounted
    // 2. Discovery starts, DashboardGraph is unmounted, Loading mounts
    // 3. Discovery stops (no accounts added), Loading unmounted, new instance of DashboardGraph gets mounted

    let body = null;
    if (discoveryStatus && discoveryStatus.status === 'exception') {
        body = <Exception exception={discoveryStatus} discovery={discovery} />;
    } else if (discoveryStatus && discoveryStatus.status === 'loading') {
        body = dashboardGraphHidden ? null : (
            <SkeletonTransactionsGraphWrapper>
                <Wrapper>
                    <GraphSkeleton data-test="@dashboard/loading" />
                </Wrapper>
            </SkeletonTransactionsGraphWrapper>
        );
    } else if (isDeviceEmpty) {
        body = <EmptyWallet />;
    } else if (!dashboardGraphHidden) {
        body = <DashboardGraph accounts={accounts} />;
    }

    const isWalletEmpty = !discoveryStatus && isDeviceEmpty;
    const isWalletLoading = discoveryStatus?.status === 'loading' ?? false;
    const isWalletError = discoveryStatus?.status === 'exception' ?? false;
    const showGraphControls =
        !isWalletEmpty && !isWalletLoading && !isWalletError && !dashboardGraphHidden;

    const showMissingDataTooltip =
        showGraphControls &&
        !!accounts.some(
            account =>
                account.history &&
                (account.tokens?.length || ['ripple', 'solana'].includes(account.networkType)),
        );

    const goToReceive = () => dispatch(goto('wallet-receive'));
    const goToBuy = () => dispatch(goto('wallet-coinmarket-buy'));

    return (
        <DashboardSection
            heading={
                <QuestionTooltip
                    label="TR_MY_PORTFOLIO"
                    tooltip={showMissingDataTooltip ? 'TR_GRAPH_MISSING_DATA' : undefined}
                />
            }
            actions={
                !isWalletEmpty && !isWalletLoading && !isWalletError ? (
                    <StyledDropdown
                        alignMenu="bottom-right"
                        items={[
                            {
                                key: 'group1',
                                label: 'Graph View',
                                options: [
                                    {
                                        key: 'graphView',
                                        label: <GraphScaleDropdownItem />,
                                        shouldCloseOnClick: false,
                                    },
                                    {
                                        key: 'hide',
                                        icon: dashboardGraphHidden ? 'SHOW' : 'HIDE',
                                        label: dashboardGraphHidden ? (
                                            <Translation id="TR_SHOW_GRAPH" />
                                        ) : (
                                            <Translation id="TR_HIDE_GRAPH" />
                                        ),
                                        shouldCloseOnClick: false,
                                        onClick: () =>
                                            dispatch(
                                                setFlag(
                                                    'dashboardGraphHidden',
                                                    !dashboardGraphHidden,
                                                ),
                                            ),
                                    },
                                ],
                            },
                        ]}
                    />
                ) : undefined
            }
        >
            <Card paddingType="none">
                {discoveryStatus && discoveryStatus.status === 'exception' ? null : (
                    <Header
                        showGraphControls={showGraphControls}
                        hideBorder={!body}
                        fiatAmount={fiatAmount}
                        localCurrency={localCurrency}
                        isWalletEmpty={isWalletEmpty}
                        isWalletLoading={isWalletLoading}
                        isWalletError={isWalletError}
                        isDiscoveryRunning={isDiscoveryRunning}
                        receiveClickHandler={goToReceive}
                        buyClickHandler={goToBuy}
                    />
                )}

                {body && <Body>{body}</Body>}
            </Card>
        </DashboardSection>
    );
});

export default PortfolioCard;
