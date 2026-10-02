export const getLedgerBitcoinAccountPath = (index: number): string => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
        throw new Error('Invalid Bitcoin account index');
    }

    return `84'/0'/${index}'`;
};
