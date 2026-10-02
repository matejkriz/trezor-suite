import { getDeviceOperationCapabilities } from '@suite-common/device';
import { type TrezorDevice } from '@suite-common/suite-types';
import { type Account } from '@suite-common/wallet-types';

export const getWalletConnectAccounts = (
    accounts: Account[],
    devices: TrezorDevice[],
): Account[] => {
    const supportedStates = new Set(
        devices
            .filter(device => getDeviceOperationCapabilities(device).trezorConnect)
            .map(device => device.state?.staticSessionId),
    );

    return accounts.filter(account => supportedStates.has(account.deviceState));
};
