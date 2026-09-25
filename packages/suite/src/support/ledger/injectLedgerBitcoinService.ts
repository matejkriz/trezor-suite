import { type LedgerBitcoinService } from '@suite-common/ledger';

export type LedgerBitcoinServiceDep = {
    ledgerBitcoinService: LedgerBitcoinService;
};

export const injectLedgerBitcoinService = (
    services: LedgerBitcoinServiceDep,
): LedgerBitcoinServiceDep => ({
    ledgerBitcoinService: services.ledgerBitcoinService,
});
