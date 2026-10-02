import {
    type LedgerAccountsDiscoveryProfile,
    type LedgerAccountsDiscoveryService,
    ledgerAccountsDiscoveryProfiles,
    serializeLedgerDiscoveryKey,
} from '@suite-common/ledger';
import { type AccountType, type NetworkSymbol, asNetworkSymbol } from '@suite-common/wallet-config';
import { type AccountInfo } from '@trezor/connect';
import { type Bip43Path } from '@trezor/crypto-utils';

type LedgerDiscoveryAccountInfoRequest = { symbol: NetworkSymbol; descriptor: string };
type LedgerDiscoveryAccountInfoResult =
    { success: true; payload: AccountInfo } | { success: false; error: { message: string } };

export type DiscoverLedgerAccountsDeps = {
    accountsDiscoveryService: LedgerAccountsDiscoveryService;
    getAccountInfo: (
        request: LedgerDiscoveryAccountInfoRequest,
    ) => Promise<LedgerDiscoveryAccountInfoResult>;
    isCurrentConnection: () => boolean;
};

export type DiscoverLedgerAccountsOptions = {
    networkSymbols: readonly NetworkSymbol[];
    signal?: AbortSignal;
    maxAccounts?: number;
};

export type DiscoveredLedgerNetworkAccount = {
    symbol: NetworkSymbol;
    index: number;
    path: Bip43Path;
    accountType: AccountType;
    accountInfo: AccountInfo;
    visible: boolean;
};

export type DiscoveredLedgerAccounts = {
    baseDescriptor: string;
    appVersion: string;
    accounts: DiscoveredLedgerNetworkAccount[];
    supportedNetworks: NetworkSymbol[];
    availableNetworks: NetworkSymbol[];
    skippedNetworks: NetworkSymbol[];
    failedNetworks: NetworkSymbol[];
};

type ActiveLedgerDiscoveryProfile = {
    profile: LedgerAccountsDiscoveryProfile;
    symbols: NetworkSymbol[];
};

export const discoverLedgerAccounts = async (
    deps: DiscoverLedgerAccountsDeps,
    options: DiscoverLedgerAccountsOptions,
): Promise<DiscoveredLedgerAccounts> => {
    const maxAccounts = options.maxAccounts ?? 10;
    if (!Number.isInteger(maxAccounts) || maxAccounts < 1 || maxAccounts > 1000) {
        throw new Error('Invalid Ledger discovery account limit');
    }
    const ensureCurrentConnection = () => {
        if (options.signal?.aborted || !deps.isCurrentConnection()) {
            throw new Error('Ledger connection canceled');
        }
    };
    ensureCurrentConnection();
    const info = await deps.accountsDiscoveryService.getInfo();
    ensureCurrentConnection();
    if (!info.profiles.includes(3))
        throw new Error('Accounts Discovery lacks the Bitcoin identity profile');

    const desiredNetworks = [...new Set(options.networkSymbols)];
    const availableProfiles = ledgerAccountsDiscoveryProfiles.filter(
        profile => info.profiles.includes(profile.id) && profile.encoding !== 'taproot',
    );
    const availableNetworks = [
        ...new Set(
            availableProfiles.flatMap(profile => profile.networkSymbols.map(asNetworkSymbol)),
        ),
    ];
    const profiles = availableProfiles
        .map(profile => ({
            profile,
            symbols: desiredNetworks.filter(symbol =>
                profile.networkSymbols.some(candidate => candidate === symbol),
            ),
        }))
        .filter(profile => profile.symbols.length > 0)
        .toSorted(
            (first, second) =>
                Number(second.profile.accountType === 'normal') -
                Number(first.profile.accountType === 'normal'),
        );
    const supportedNetworks = desiredNetworks.filter(symbol =>
        profiles.some(profile => profile.symbols.includes(symbol)),
    );
    const skippedNetworks = new Set(
        desiredNetworks.filter(symbol => !supportedNetworks.includes(symbol)),
    );
    const primaryProfiles = new Map<NetworkSymbol, number>();
    for (const { profile, symbols } of profiles) {
        for (const symbol of symbols) {
            if (!primaryProfiles.has(symbol)) primaryProfiles.set(symbol, profile.id);
        }
    }

    const accounts: DiscoveredLedgerNetworkAccount[] = [];
    const failedNetworks = new Set<NetworkSymbol>();
    const stoppedProfiles = new Set<string>();
    const backendCache = new Map<string, AccountInfo>();
    const returnedAccounts = new Set<string>();
    let baseDescriptor: string | undefined;
    let isApproved = false;

    try {
        ensureCurrentConnection();
        await deps.accountsDiscoveryService.open();
        isApproved = true;
        ensureCurrentConnection();

        for (let index = 0; index < maxAccounts; index++) {
            const activeProfiles: ActiveLedgerDiscoveryProfile[] = profiles
                .filter(({ profile }) => index === 0 || profile.accountType !== 'root')
                .map(({ profile, symbols }) => ({
                    profile,
                    symbols: symbols.filter(
                        symbol => !stoppedProfiles.has(`${profile.id}:${symbol}`),
                    ),
                }))
                .filter(profile => profile.symbols.length > 0);
            const requests = activeProfiles.map(({ profile }) => ({
                profile: profile.id,
                account: index,
            }));
            if (index === 0 && !requests.some(request => request.profile === 3)) {
                requests.unshift({ profile: 3, account: 0 });
            }
            if (requests.length === 0) break;

            ensureCurrentConnection();
            const keys = await deps.accountsDiscoveryService.readPublicKeys(requests);
            ensureCurrentConnection();
            if (keys.length !== requests.length)
                throw new Error('Accounts Discovery returned an incomplete batch');

            for (const [keyIndex, key] of keys.entries()) {
                if (key.profile !== requests[keyIndex]?.profile || key.account !== index) {
                    throw new Error('Accounts Discovery returned an unexpected account key');
                }
                const serialized = serializeLedgerDiscoveryKey(key);
                if (!serialized.success)
                    throw new Error('Accounts Discovery returned an invalid public key');
                if (key.profile === 3 && index === 0)
                    baseDescriptor = serialized.payload.descriptor;
                const activeProfile = activeProfiles.find(
                    profile => profile.profile.id === key.profile,
                );
                if (!activeProfile) continue;

                for (const symbol of activeProfile.symbols) {
                    const cacheKey = `${symbol}:${serialized.payload.descriptor}`;
                    let accountInfo = backendCache.get(cacheKey);
                    if (!accountInfo) {
                        let response: LedgerDiscoveryAccountInfoResult | undefined;
                        ensureCurrentConnection();
                        try {
                            response = await deps.getAccountInfo({
                                symbol,
                                descriptor: serialized.payload.descriptor,
                            });
                        } catch {
                            // Backend failures must not expose confidential request URLs or wallet data.
                        }
                        ensureCurrentConnection();
                        if (!response?.success) {
                            skippedNetworks.add(symbol);
                            failedNetworks.add(symbol);
                            stoppedProfiles.add(`${key.profile}:${symbol}`);
                            continue;
                        }
                        accountInfo = response.payload;
                        if (accountInfo.descriptor !== serialized.payload.descriptor) {
                            throw new Error(
                                'Suite backend returned an unexpected account descriptor',
                            );
                        }
                        backendCache.set(cacheKey, accountInfo);
                    }
                    if (accountInfo.empty) stoppedProfiles.add(`${key.profile}:${symbol}`);
                    if (returnedAccounts.has(cacheKey)) continue;
                    returnedAccounts.add(cacheKey);
                    accounts.push({
                        symbol,
                        index,
                        path: serialized.payload.path as Bip43Path,
                        accountType: serialized.payload.accountType,
                        accountInfo,
                        visible:
                            !accountInfo.empty ||
                            (index === 0 && primaryProfiles.get(symbol) === key.profile),
                    });
                }
            }
        }
        if (!baseDescriptor)
            throw new Error('Accounts Discovery did not return the Bitcoin identity key');

        return {
            baseDescriptor,
            appVersion: info.appVersion,
            accounts,
            supportedNetworks,
            availableNetworks,
            skippedNetworks: [...skippedNetworks],
            failedNetworks: [...failedNetworks],
        };
    } finally {
        if (isApproved && deps.isCurrentConnection()) {
            await deps.accountsDiscoveryService.close();
        }
    }
};
