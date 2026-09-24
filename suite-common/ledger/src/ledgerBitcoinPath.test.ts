import { getLedgerBitcoinAccountPath } from './ledgerBitcoinPath';

describe('getLedgerBitcoinAccountPath', () => {
    it.each([
        [0, "84'/0'/0'"],
        [1, "84'/0'/1'"],
    ])('uses the BIP84 Bitcoin path for account %i', (index, path) => {
        expect(getLedgerBitcoinAccountPath(index)).toBe(path);
    });

    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid account index %s', index => {
        expect(() => getLedgerBitcoinAccountPath(index)).toThrow('Invalid Bitcoin account index');
    });
});
