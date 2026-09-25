import { getLedgerWalletIdentity } from './getLedgerWalletIdentity';

describe('getLedgerWalletIdentity', () => {
    it('returns a stable, hyphen-free identity for a normalized account descriptor', () => {
        expect(getLedgerWalletIdentity('zpub-public-test')).toBe(
            'ledger6697824f2c8e6090e5d880e31d120c36a7902cd533c6236d0234ad52b68e4691',
        );
    });

    it('distinguishes different account descriptors', () => {
        expect(getLedgerWalletIdentity('zpub-public-test')).not.toBe(
            getLedgerWalletIdentity('zpub-other-public-test'),
        );
    });
});
