import { Transaction } from '../src/transaction';
import * as NETWORKS from '../src/networks';
import fixtures from './__fixtures__/transaction/bitcoin';
import fixturesDash from './__fixtures__/transaction/dash';
import fixturesDecred from './__fixtures__/transaction/decred';
import fixturesDoge from './__fixtures__/transaction/doge';
import fixturesKomodo from './__fixtures__/transaction/komodo';
import fixturesPeercoin from './__fixtures__/transaction/peercoin';
import fixturesZcash from './__fixtures__/transaction/zcash';

describe('Transaction', () => {
    describe('fromBuffer/fromHex', () => {
        fixtures.valid.forEach(f => {
            it(`imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.hex);
                tx.ins.forEach((input, i) => {
                    expect(input.hash.toString('hex')).toEqual(f.raw.ins[i].hash);
                });
                tx.outs.forEach((output, i) => {
                    expect(output.value).toEqual(f.raw.outs[i].value.toString());
                });

                if (!f.whex) {
                    expect(tx.virtualSize()).toEqual(f.virtualSize);
                    expect(tx.weight()).toEqual(f.weight);
                }

                expect(tx.toHex()).toEqual(f.hex);
            });

            if (f.whex) {
                it(`imports ${f.description} (${f.hash}) as witness`, () => {
                    const actual = Transaction.fromHex(f.whex);
                    expect(actual.virtualSize()).toEqual(f.virtualSize);
                    expect(actual.weight()).toEqual(f.weight);
                    expect(actual.toHex()).toEqual(f.whex);
                });
            }
        });

        it('.version should be interpreted as an int32le', () => {
            const txHex = 'ffffffff0000ffffffff';
            const tx = Transaction.fromHex(txHex);
            expect(tx.version).toEqual(-1);
            expect(tx.locktime).toEqual(0xffffffff);
        });

        fixtures.hashForSignature.forEach(f => {
            it(`imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.txHex);
                expect(tx.toHex()).toEqual(f.txHex);
            });
        });

        fixtures.hashForWitnessV0.forEach(f => {
            it(`imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.txHex);
                expect(tx.toHex()).toEqual(f.txHex);
            });
        });

        fixtures.invalid.fromBuffer.forEach(f => {
            it(`throws on ${f.exception}`, () => {
                expect(() => Transaction.fromHex(f.hex)).toThrow(f.exception);
            });
        });

        fixturesDash.valid.forEach(f => {
            it(`Dash: imports ${f.description}`, () => {
                const tx = Transaction.fromHex(f.hex, { network: NETWORKS.dashTest });
                expect(tx.version).toEqual(f.version);
                if (f.type) {
                    expect(tx.type).toEqual(f.type);
                }
                expect(tx.locktime).toEqual(f.locktime);
                expect(tx.ins.length).toEqual(f.vin.length);
                expect(tx.outs.length).toEqual(f.vout.length);

                const extraData = tx.getExtraData();
                if (extraData) {
                    expect(extraData.toString('hex')).toEqual(f.extraData);
                }

                expect(tx.toHex()).toEqual(f.hex);
            });
        });

        fixturesDecred.valid.forEach((f: any) => {
            it(`Decred: imports ${f.description}`, () => {
                const tx = Transaction.fromHex(f.hex, { network: NETWORKS.decred });

                expect(tx.version).toEqual(f.version);
                expect(tx.type).toEqual(f.type);
                expect(tx.ins.length).toEqual(f.ins.length);
                expect(tx.outs.length).toEqual(f.outs.length);
                expect(tx.locktime).toEqual(f.locktime);
                expect(tx.expiry).toEqual(f.expiry);
                tx.ins.forEach((input, i) => {
                    const hashCopy = Buffer.allocUnsafe(32);
                    input.hash.copy(hashCopy);
                    expect(hashCopy.reverse().toString('hex')).toEqual(f.ins[i].hash);
                    expect(input.index).toEqual(f.ins[i].index);
                    expect(input.decredTree).toEqual(f.ins[i].tree);
                    expect(input.sequence).toEqual(f.ins[i].sequence);
                    if (tx.hasWitnesses() && input.decredWitness) {
                        const witness = input.decredWitness;
                        expect(witness.script.toString('hex')).toEqual(f.ins[i].script);
                        expect(witness.value).toEqual(f.ins[i].value);
                        expect(witness.height).toEqual(f.ins[i].height);
                        expect(witness.blockIndex).toEqual(f.ins[i].blockIndex);
                    }
                });
                tx.outs.forEach((output, i) => {
                    expect(output.value).toEqual(f.outs[i].value);
                    expect(output.script.toString('hex')).toEqual(f.outs[i].script);
                    expect(output.decredVersion).toEqual(f.outs[i].version);
                });

                expect(tx.toHex()).toEqual(f.hex);
            });
        });

        fixturesDecred.invalid.forEach(f => {
            it(`Decred: throws ${f.exception} for ${f.description}`, () => {
                expect(() => Transaction.fromHex(f.hex, { network: NETWORKS.decred })).toThrow(
                    f.exception,
                );
            });
        });

        fixturesDoge.valid.forEach(f => {
            it(`Doge: imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.hex);
                expect(tx.version).toEqual(1);
                tx.ins.forEach((input, i) => {
                    const expected = f.raw.ins[i];
                    expect(input.hash.toString('hex')).toEqual(expected.hash);
                    expect(input.index).toEqual(expected.index);
                    expect(input.script.toString('hex')).toEqual(expected.script);
                    expect(input.sequence).toEqual(expected.sequence);
                });
                tx.outs.forEach((output, i) => {
                    const expected = f.raw.outs[i];
                    expect(output.value).toEqual(expected.value);
                    expect(output.script.toString('hex')).toEqual(expected.script);
                });
                expect(tx.locktime).toEqual(f.raw.locktime);
                expect(tx.getId()).toEqual(f.hash);
                expect(tx.toHex()).toEqual(f.hex);
            });
        });

        fixturesKomodo.valid.forEach(f => {
            it(`Komodo: imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.hex, { network: NETWORKS.komodo });
                expect(tx.version).toEqual(f.raw.version);
                tx.ins.forEach((input, i) => {
                    const expected = f.raw.ins[i];
                    expect(input.hash.toString('hex')).toEqual(expected.hash);
                    expect(input.index).toEqual(expected.index);
                    expect(input.script.toString('hex')).toEqual(expected.script);
                    expect(input.sequence).toEqual(expected.sequence);
                });
                tx.outs.forEach((output, i) => {
                    const expected = f.raw.outs[i];
                    expect(output.value).toEqual(expected.value);
                    expect(output.script.toString('hex')).toEqual(expected.script);
                });
                expect(tx.locktime).toEqual(f.raw.locktime);
                expect(tx.getId()).toEqual(f.hash);
                expect(tx.toHex()).toEqual(f.hex);
            });
        });

        fixturesPeercoin.valid.forEach(f => {
            it(`Peercoin: imports ${f.description} (${f.hash})`, () => {
                const tx = Transaction.fromHex(f.hex, { network: NETWORKS.peercoin });
                tx.ins.forEach((input, i) => {
                    const expected = f.raw.ins[i];
                    expect(input.hash.toString('hex')).toEqual(expected.hash);
                    expect(input.index).toEqual(expected.index);
                    expect(input.script.toString('hex')).toEqual(expected.script);
                    expect(input.sequence).toEqual(expected.sequence);
                });
                tx.outs.forEach((output, i) => {
                    const expected = f.raw.outs[i];
                    expect(output.value).toEqual(expected.value);
                    expect(output.script.toString('hex')).toEqual(expected.script);
                });
                expect(tx.timestamp).toEqual(f.raw.timestamp);
                expect(tx.getId()).toEqual(f.hash);
                expect(tx.toHex()).toEqual(f.hex);
            });
        });

        fixturesZcash.valid.forEach(f => {
            it(`Zcash: imports ${f.description}`, () => {
                const tx = Transaction.fromHex(f.hex, { network: NETWORKS.zcash });
                expect(tx.version).toEqual(f.version);
                expect(tx.locktime).toEqual(f.locktime);
                expect(tx.expiry).toEqual(f.expiry);
                expect(tx.ins.length).toEqual(f.insLength);
                expect(tx.outs.length).toEqual(f.outsLength);

                const specificData = tx.getSpecificData()!;
                expect(specificData.versionGroupId).toEqual(
                    typeof f.versionGroupId === 'number'
                        ? f.versionGroupId
                        : parseInt(f.versionGroupId, 16),
                );
                expect(specificData.overwintered).toEqual(f.overwintered);

                expect(specificData.joinsplits.length).toEqual(f.joinsplitsLength);
                expect(specificData.joinsplitPubkey.length).toEqual(f.joinsplitPubkeyLength);
                expect(specificData.joinsplitSig.length).toEqual(f.joinsplitSigLength);

                if (f.valueBalance) {
                    expect(specificData.valueBalance).toEqual(f.valueBalance);
                }
                if (f.nShieldedSpend) {
                    const shieldedSpend = specificData.vShieldedSpend;
                    for (let i = 0; i < f.nShieldedSpend; ++i) {
                        expect(shieldedSpend[i].cv.toString('hex')).toEqual(f.vShieldedSpend[i].cv);
                        expect(shieldedSpend[i].anchor.toString('hex')).toEqual(
                            f.vShieldedSpend[i].anchor,
                        );
                        expect(shieldedSpend[i].nullifier.toString('hex')).toEqual(
                            f.vShieldedSpend[i].nullifier,
                        );
                        expect(shieldedSpend[i].rk.toString('hex')).toEqual(f.vShieldedSpend[i].rk);
                        expect(
                            shieldedSpend[i].zkproof.sA.toString('hex') +
                                shieldedSpend[i].zkproof.sB.toString('hex') +
                                shieldedSpend[i].zkproof.sC.toString('hex'),
                        ).toEqual(f.vShieldedSpend[i].zkproof);
                        expect(shieldedSpend[i].spendAuthSig.toString('hex')).toEqual(
                            f.vShieldedSpend[i].spendAuthSig,
                        );
                    }
                }

                const extraData = tx.getExtraData();
                if (extraData) {
                    expect(extraData.toString('hex')).toEqual(f.extraData);
                }

                expect(tx.toHex()).toEqual(f.hex);
            });
        });
    });
});
