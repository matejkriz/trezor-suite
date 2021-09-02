import { bitcoin as BITCOIN_NETWORK, isNetworkType } from '../networks';
import { isCoinbaseHash, TransactionOptions } from './base';
import { fromBitcoinBuffer } from './bitcoin';
import { fromDashBuffer } from './dash';
import { fromDecredBuffer } from './decred';
import { fromPeercoinBuffer } from './peercoin';
import { fromZcashBuffer } from './zcash';

const fromBuffer = (buffer: Buffer, opt: TransactionOptions = {}) => {
    const options = {
        network: opt.network || BITCOIN_NETWORK,
        useStringValues: typeof opt.useStringValues === 'boolean' ? opt.useStringValues : true,
        nostrict: typeof opt.nostrict === 'boolean' ? opt.nostrict : true,
    };
    if (isNetworkType('dash', options.network)) return fromDashBuffer(buffer, options);
    if (isNetworkType('decred', options.network)) return fromDecredBuffer(buffer, options);
    if (isNetworkType('peercoin', options.network)) return fromPeercoinBuffer(buffer, options);
    if (isNetworkType('zcashType', options.network)) return fromZcashBuffer(buffer, options);
    return fromBitcoinBuffer(buffer, options);
};

export const Transaction = {
    isCoinbaseHash,
    fromBuffer,
    fromHex: (hex: string, options: TransactionOptions = {}) =>
        fromBuffer(Buffer.from(hex, 'hex'), Object.assign(options, { nostrict: false })),
};

export type { TransactionOptions } from './base';
