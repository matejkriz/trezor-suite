export const CUSTOM_FEE = 'custom' as const;
export const FIRST_OUTPUT_ID = 0;
export const BTC_LOCKTIME_SEQUENCE = 0xffffffff - 1;
export const BTC_LOCKTIME_VALUE = 500000000; // if locktime is greater than this then it's a timestamp
export const BTC_RBF_SEQUENCE = 0xffffffff - 2;
export const XRP_FLAG = 0x80000000;
export const U_INT_32 = 0xffffffff;
export const ETH_DEFAULT_GAS_PRICE = '1';
export const ETH_DEFAULT_GAS_LIMIT = '21000';

// todo: remove after zcash heartwood fork;
export const ZEC_SIGN_ENHANCEMENT_LEGACY = {
    overwintered: true,
    version: 4,
    versionGroupId: 0x892f2085,
    branchId: 0x2bb40e60,
};

export const ZEC_SIGN_ENHANCEMENT = {
    overwintered: true,
    version: 4,
    versionGroupId: 0x892f2085,
    branchId: 0xf5b9230b,
};

export const ERC20_TRANSFER = 'a9059cbb'; // 4 bytes function signature of solidity erc20 `transfer(address,uint256)`
export const ERC20_GAS_LIMIT = '200000';

export const DEFAULT_PAYMENT = {
    type: 'payment',
    address: '',
    amount: '',
    fiat: '',
    currency: { value: 'usd', label: 'USD' },
    token: null,
    label: '',
    labelEnabled: false,
} as const;

export const DEFAULT_OPRETURN = {
    type: 'opreturn',
    dataAscii: '',
    dataHex: '',
    label: '',
    labelEnabled: false,
} as const;

export const DEFAULT_OPTIONS = ['broadcast', 'bitcoinRBF'] as const;

export const DEFAULT_VALUES = {
    setMaxOutputId: undefined,
    selectedFee: undefined,
    feePerUnit: '',
    feeLimit: '',
    options: [],
    bitcoinLockTime: '',
    ethereumNonce: '',
    ethereumDataAscii: '',
    ethereumDataHex: '',
    rippleDestinationTag: '',
    outputs: [],
} as const;
