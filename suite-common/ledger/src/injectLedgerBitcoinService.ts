import { type LedgerBitcoinService } from './createLedgerBitcoinService';

export type LedgerBitcoinServiceDep = {
    ledgerBitcoinService: LedgerBitcoinService;
};

export const injectLedgerBitcoinService = (
    services: LedgerBitcoinServiceDep,
): LedgerBitcoinServiceDep => ({
    ledgerBitcoinService: services.ledgerBitcoinService,
});
