import type { Network } from './types';

export const bitcoin: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: 'btc',
};

export const regtest: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bcrt',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: 'test',
};

export const testnet: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: 'test',
};

export const bitcoincash: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: 'bch',
    forkId: 0x00,
};

export const bitcoincashTestnet: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: 'bch',
};

export const bitcoinsv: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: 'bsv',
    forkId: 0x00,
};

export const bitcoinsvTestnet: Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: 'bsv',
};

export const bitcoingold: Network = {
    messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
    bech32: 'btg',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x26,
    scriptHash: 0x17,
    wif: 0x80,
    coin: 'btg',
    forkId: 0x4f /* 79 */,
};

export const litecoin: Network = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: {
        public: 0x019da462,
        private: 0x019d9cfe,
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    coin: 'ltc',
};

export const litecoinTest: Network = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'tltc',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0x3a,
    wif: 0xb0,
    coin: 'ltc',
};

export const dash: Network = {
    messagePrefix: '\x19DarkCoin Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x4c, // https://dash-docs.github.io/en/developer-reference#opcodes
    scriptHash: 0x10,
    wif: 0xcc,
    coin: 'dash',
};

export const dashTest: Network = {
    messagePrefix: '\x19DarkCoin Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x8c, // https://dash-docs.github.io/en/developer-reference#opcodes
    scriptHash: 0x13,
    wif: 0xef, // https://github.com/dashpay/godashutil/blob/master/wif.go#L72
    coin: 'dash',
};

export const zcash: Network = {
    messagePrefix: '\x18ZCash Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x1cb8,
    scriptHash: 0x1cbd,
    wif: 0x80,
    // This parameter was introduced in version 3 to allow soft forks, for version 1 and 2 transactions we add a
    // dummy value.
    consensusBranchId: {
        1: 0x00,
        2: 0x00,
        3: 0x5ba81b19,
        // 4: 0x76b809bb (old Sapling branch id). Blossom branch id becomes effective after block 653600
        4: 0x2bb40e60,
    },
    coin: 'zec',
};

export const zcashTest: Network = {
    messagePrefix: '\x18ZCash Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x1d25,
    scriptHash: 0x1cba,
    wif: 0xef,
    consensusBranchId: {
        1: 0x00,
        2: 0x00,
        3: 0x5ba81b19,
        // 4: 0x76b809bb (old Sapling branch id)
        4: 0x2bb40e60,
    },
    coin: 'taz',
};

export const peercoin: Network = {
    messagePrefix: '\x18Peercoin Signed Message:\n',
    bech32: 'pc',
    bip32: {
        public: 0x488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x37,
    scriptHash: 0x75,
    wif: 0,
    coin: 'ppc',
};

export const peercoinTest: Network = {
    messagePrefix: '\x18Peercoin Signed Message:\n',
    bech32: 'tpc',
    bip32: {
        public: 0x43587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0,
    coin: 'tppc',
};

export const komodo: Network = {
    messagePrefix: '\x18Komodo Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x3c,
    scriptHash: 0x05,
    wif: 0xbc,
    // This parameter was introduced in version 3 to allow soft forks, for version 1 and 2 transactions we add a
    // dummy value.
    consensusBranchId: {
        1: 0x00,
        2: 0x00,
        3: 0x5ba81b19,
        4: 0x76b809bb,
    },
    coin: 'kmd',
};

export const decred: Network = {
    messagePrefix: '\x17Decred Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x02fda926,
        private: 0x02fda4e8,
    },
    pubKeyHash: 0x073f,
    scriptHash: 0x071a,
    wif: 0x22de,
    coin: 'dcr',
};

export const decredTest: Network = {
    messagePrefix: '\x17Decred Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x043587d1,
        private: 0x04358397,
    },
    pubKeyHash: 0x0f21,
    scriptHash: 0x0efc,
    wif: 0x230e,
    coin: 'tdcr',
};

export const decredSim: Network = {
    messagePrefix: '\x17Decred Signed Message:\n',
    bech32: '',
    bip32: {
        public: 0x0420bd3d,
        private: 0x0420b903,
    },
    pubKeyHash: 0x0e91,
    scriptHash: 0x0e6c,
    wif: 0x2307,
    coin: 'sdcr',
};

const NETWORK_TYPES = {
    dash: [dash.coin, dashTest.coin],
    decred: [decred.coin, decredTest.coin, decredSim.coin],
    komodo: [komodo.coin],
    peercoin: [peercoin.coin, peercoinTest.coin],
    zcash: [zcash.coin, zcashTest.coin],
    zcashType: [zcash.coin, zcashTest.coin, komodo.coin],
};

export function isNetworkType(type: keyof typeof NETWORK_TYPES, network: Network) {
    if (typeof type !== 'string' || !NETWORK_TYPES[type]) return false;
    return NETWORK_TYPES[type].includes(network.coin.toLowerCase());
}
