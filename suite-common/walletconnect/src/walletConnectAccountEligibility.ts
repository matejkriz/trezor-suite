import { isLedgerDevice } from '@suite-common/device';
import { type TrezorDevice } from '@suite-common/suite-types';
import { type Account } from '@suite-common/wallet-types';

export const getWalletConnectAccounts = (
    accounts: Account[],
    devices: TrezorDevice[],
): Account[] => {
    const ledgerWalletStates = new Set(
        devices.filter(isLedgerDevice).map(device => device.state?.staticSessionId),
    );

    return accounts.filter(
        account =>
            !account.deviceState.endsWith('@ledger:0') &&
            !ledgerWalletStates.has(account.deviceState),
    );
};
