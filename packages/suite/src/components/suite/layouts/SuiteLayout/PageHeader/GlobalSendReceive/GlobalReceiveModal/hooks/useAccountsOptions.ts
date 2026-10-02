import { useMemo } from 'react';
import { useThrottle } from 'react-use';

import { selectActiveWalletStaticSessionId } from '@suite-common/device';
import {
    type SuiteSyncDataRootState,
    selectAccountsWithSuiteSyncLabel,
} from '@suite-common/suite-sync';
import { selectAllAccountsToList } from '@suite-common/wallet-core';

import { useSelector } from 'src/hooks/suite';

export function useAccountsOptions() {
    const baseAccounts = useSelector(selectAllAccountsToList);
    const activeWalletStaticSessionId = useSelector(selectActiveWalletStaticSessionId);

    const accounts = useSelector((state: SuiteSyncDataRootState) =>
        selectAccountsWithSuiteSyncLabel(state, baseAccounts, activeWalletStaticSessionId ?? null),
    );

    const throttledAccounts = useThrottle(accounts, 1000);

    return useMemo(() => throttledAccounts.map(account => ({ account })), [throttledAccounts]);
}

export type AccountOption = ReturnType<typeof useAccountsOptions>[number];
