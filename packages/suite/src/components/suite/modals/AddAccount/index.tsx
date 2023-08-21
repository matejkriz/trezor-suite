import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from '@trezor/components';
import { Translation, Modal } from 'src/components/suite';
import { NETWORKS } from 'src/config/wallet';
import { Account, Network } from 'src/types/wallet';
import { TrezorDevice } from 'src/types/suite';
import { useSelector, useDispatch } from 'src/hooks/suite';
import { accountsActions } from '@suite-common/wallet-core';
import { changeCoinVisibility } from 'src/actions/settings/walletSettingsActions';
import { goto } from 'src/actions/suite/routerActions';
import { arrayPartition } from '@trezor/utils';
import { selectIsPublic } from 'src/reducers/wallet/coinjoinReducer';

import { AccountTypeSelect } from './components/AccountTypeSelect';
import { SelectNetwork } from './components/SelectNetwork';
import { EnableNetwork } from './components/EnableNetwork';
import { AddAccountButton } from './components/AddAccountButton';
import { useEnabledNetworks } from 'src/hooks/settings/useEnabledNetworks';
import { selectSupportedNetworks } from 'src/reducers/suite/suiteReducer';

const StyledModal = styled(Modal)`
    width: 560px;
    text-align: left;
`;

const Expander = styled.div`
    display: flex;
    flex: 1;
`;
interface AddAccountProps {
    device: TrezorDevice;
    onCancel: () => void;
    symbol?: Account['symbol'];
    noRedirect?: boolean;
}

export const AddAccount = ({ device, onCancel, symbol, noRedirect }: AddAccountProps) => {
    const accounts = useSelector(state => state.wallet.accounts);
    const app = useSelector(state => state.router.app);
    const debug = useSelector(state => state.suite.settings.debug);
    const isCoinjoinPublic = useSelector(selectIsPublic);
    const dispatch = useDispatch();

    const { mainnets, testnets, enabledNetworks: enabledNetworksSymbols } = useEnabledNetworks();

    const mainnetSymbols = mainnets.map(mainnet => mainnet.symbol);
    const testnetSymbols = testnets.map(testnet => testnet.symbol);

    const supportedNetworks = useSelector(selectSupportedNetworks);
    const supportedMainnetNetworks = supportedNetworks.filter(network =>
        mainnetSymbols.includes(network),
    );

    const hasMainnetNetworksToEnable = supportedMainnetNetworks.some(
        network => !enabledNetworksSymbols.includes(network),
    );

    const allTestnetNetworksDisabled = !supportedNetworks.some(
        network => testnetSymbols.includes(network) && enabledNetworksSymbols.includes(network),
    );

    const isCoinjoinVisible = isCoinjoinPublic || debug.showDebugMenu;

    // Collect all Networks without "accountType" (normal)
    const internalNetworks = NETWORKS.filter(n => !n.accountType && !n.isHidden);

    // applied only when changing account in coinmarket exchange receive options context so far
    const networkPinned = !!symbol;
    const preselectedNetwork = symbol && internalNetworks.find(n => n.symbol === symbol);

    const [selectedNetwork, selectNetwork] = useState<Network | undefined>(preselectedNetwork);

    const selectedNetworkEnabled =
        !!selectedNetwork && enabledNetworksSymbols.includes(selectedNetwork.symbol);

    const [enabledNetworks, disabledNetworks] = arrayPartition(internalNetworks, network =>
        enabledNetworksSymbols.includes(network.symbol),
    );

    const [disabledMainnetNetworks, disabledTestnetNetworks] = arrayPartition(
        disabledNetworks,
        network => !network?.testnet,
    );

    const availableDisabledTestnetNetworks = disabledTestnetNetworks.filter(
        (n: Network) => !(n.symbol === 'regtest' && !debug.showDebugMenu),
    );

    const handleNetworkSelection = (symbol?: Network['symbol']) => {
        if (symbol) {
            const networkToSelect = NETWORKS.find(n => n.symbol === symbol);

            // To prevent account type selection reset
            const alreadySelected =
                !!networkToSelect && networkToSelect?.symbol === selectedNetwork?.symbol;

            if (networkToSelect && !networkPinned && !alreadySelected) {
                selectNetwork(networkToSelect);
            }
        } else {
            selectNetwork(undefined);
        }
    };

    const onEnableNetwork = () => {
        onCancel();
        if (selectedNetwork) {
            dispatch(changeCoinVisibility(selectedNetwork.symbol, true));
            if (app === 'wallet' && !noRedirect) {
                // redirect to account only if added from "wallet" app
                dispatch(
                    goto('wallet-index', {
                        params: {
                            symbol: selectedNetwork.symbol,
                            accountIndex: 0,
                            accountType: 'normal',
                        },
                    }),
                );
            }
        }
    };

    // Collect all empty accounts related to selected device and selected accountType
    const currentType = selectedNetwork?.accountType ?? 'normal';
    const emptyAccounts = selectedNetwork
        ? accounts.filter(
              a =>
                  a.deviceState === device.state &&
                  a.symbol === selectedNetwork.symbol &&
                  a.accountType === currentType &&
                  a.empty,
          )
        : [];

    // Collect possible accountTypes
    const accountTypes =
        selectedNetworkEnabled && selectedNetwork?.networkType === 'bitcoin'
            ? NETWORKS.filter(n => n.symbol === selectedNetwork.symbol)
                  /**
                   * Filter out coinjoin account type if it is not visible.
                   * Visibility of coinjoin account type depends on coinjoin feature config in message system.
                   * By default it is visible publicly, but it can be remotely hidden under debug menu.
                   */
                  .filter(({ backendType }) => backendType !== 'coinjoin' || isCoinjoinVisible)
            : undefined;

    const onEnableAccount = (account: Account) => {
        onCancel();
        dispatch(accountsActions.changeAccountVisibility(account));
        if (app === 'wallet' && !noRedirect) {
            // redirect to account only if added from "wallet" app
            dispatch(
                goto('wallet-index', {
                    params: {
                        symbol: account.symbol,
                        accountIndex: account.index,
                        accountType: account.accountType,
                    },
                }),
            );
        }
    };

    const selectedNetworks = selectedNetwork ? [selectedNetwork.symbol] : [];

    return (
        <StyledModal
            isCancelable
            onCancel={onCancel}
            onBackClick={
                selectedNetwork && !networkPinned ? () => selectNetwork(undefined) : undefined
            }
            heading={<Translation id="MODAL_ADD_ACCOUNT_TITLE" />}
            bottomBar={
                selectedNetwork &&
                (selectedNetworkEnabled ? (
                    <AddAccountButton
                        network={selectedNetwork}
                        emptyAccounts={emptyAccounts}
                        onEnableAccount={onEnableAccount}
                    />
                ) : (
                    <Button variant="primary" onClick={onEnableNetwork}>
                        <Translation
                            id="TR_ENABLE_NETWORK_BUTTON"
                            values={{ networkName: selectedNetwork.name }}
                        />
                    </Button>
                ))
            }
        >
            <SelectNetwork
                networks={
                    selectedNetwork && selectedNetworkEnabled ? [selectedNetwork] : enabledNetworks
                }
                networkCanChange={!!selectedNetwork && selectedNetworkEnabled && !networkPinned}
                selectedNetworks={selectedNetworks}
                handleNetworkSelection={handleNetworkSelection}
            />
            {hasMainnetNetworksToEnable && !selectedNetworkEnabled && (
                <EnableNetwork
                    networks={disabledMainnetNetworks}
                    testnetNetworks={availableDisabledTestnetNetworks}
                    selectedNetworks={selectedNetworks}
                    handleNetworkSelection={handleNetworkSelection}
                />
            )}
            {selectedNetwork && (
                <>
                    {accountTypes && accountTypes?.length > 1 && (
                        <AccountTypeSelect
                            network={selectedNetwork}
                            accountTypes={accountTypes}
                            onSelectAccountType={selectNetwork}
                        />
                    )}

                    <Expander />
                </>
            )}
        </StyledModal>
    );
};
