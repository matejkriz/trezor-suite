import { createLedgerSuiteDevice } from 'src/support/ledger/createLedgerSuiteDevice';

import { type LegacyExternalWallet } from './legacyExternalWallet';

export const restoreLegacyLedgerDevices = (
    existingDeviceIds: ReadonlySet<string>,
    wallets: readonly LegacyExternalWallet[] = [],
) => {
    const knownIds = new Set(existingDeviceIds);

    return wallets.flatMap(wallet => {
        if (knownIds.has(wallet.id)) return [];
        knownIds.add(wallet.id);

        return [{ ...createLedgerSuiteDevice(wallet), connected: false }];
    });
};
