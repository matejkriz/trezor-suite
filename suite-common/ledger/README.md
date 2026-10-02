# Ledger Bitcoin proof of concept

This package wraps Ledger Device Management Kit and Bitcoin Device Signer Kit. The transport is injected by each application: WebHID for Suite Web and Desktop, and React Native BLE for Suite Native. It derives BIP84 Bitcoin accounts, supports on-device address verification, and signs Bitcoin transactions through PSBT. All applications store connected Ledger wallets in the regular device and account state and use the existing account, receive, send, and trading flows through the injected wallet device service.

Connecting reads the user-assigned name from the device OS dashboard before the signer opens Bitcoin. Firmware without the name command uses a neutral `Ledger` label. Device settings show the reported model, OS, Bitcoin app version, and battery level when available; unsupported operations are hidden through device capabilities.

The proof of concept supports Bitcoin BIP84 accounts. Ledger firmware, backup, passphrase, Suite Sync, Connect popup, and WalletConnect operations remain unavailable in Suite. Transaction signing rejects RBF and OP_RETURN until those paths are implemented and verified.

## Speculos smoke test

The test uses Ledger's open-source Bitcoin app and the official Speculos container. Build the mainnet app for Nano S+:

```sh
git clone --branch 2.4.2 --depth 1 https://github.com/LedgerHQ/app-bitcoin.git /tmp/ledger-app-bitcoin
ln -s src/debug-helpers /tmp/ledger-app-bitcoin/debug-helpers
docker run --rm -v /tmp/ledger-app-bitcoin:/app -w /app ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder-lite:latest make COIN=bitcoin -j4
```

In separate terminals, start Speculos and run the smoke test from the repository root:

```sh
docker run --rm -p 127.0.0.1:5000:5000 -v /tmp/ledger-app-bitcoin/bin/app.elf:/app/app.elf:ro -v "$PWD/suite-common/ledger/scripts/speculos-automation.json:/app/automation.json:ro" ghcr.io/ledgerhq/speculos:latest --model nanosp --display headless --api-port 5000 --automation file:/app/automation.json /app/app.elf
yarn workspace @suite-common/ledger test:speculos
```

The smoke test checks account derivation, confirms a receiving address on the simulated device, and signs a Bitcoin PSBT. It checks the signed inputs, outputs, and witness public key without printing wallet data or broadcasting the transaction. The fixture uses Speculos's disposable default test seed and a fabricated UTXO. The automation approves only this simulator's review screens; it must never be used with a real wallet.

## Accounts Discovery app

[The custom Flex app](../../ledger-apps/accounts-discovery/README.md) exports
public account keys for the Suite network set in one consent session. The custom
app uses short APDUs through the existing injected DMK transport. It does not use
LedgerJS, sign transactions, export private keys, or require network-app switches.

Install the app, enable experimental Ledger support, then choose **Connect Ledger**.
On every connection, Suite checks the installed apps through DMK's local
`ListAppsDeviceAction`. Approve listing apps on the Ledger when prompted. This
check does not use Ledger's backend or a secure-channel app catalogue. If Accounts
Discovery is installed, Suite opens it and reads its protocol metadata before
requesting approval to export public account data. Without that app, Suite opens
Bitcoin and discovers BIP84 accounts. Rejected checks and communication/protocol
errors fail the connection instead of silently downgrading to Bitcoin-only.

Suite derives available network capabilities and firmware type from the custom
app's advertised profiles, while unsupported signing and device operations remain
disabled. Availability is rechecked on reconnect, including after uninstalling the
app. Speculos has no OS app list, so the adapter probes the running ELF's metadata.

Suite discovers enabled networks into its ordinary devices and accounts; if no
networks are enabled, it starts with BTC and ETH.
Discovery stops each network/profile at its first unused account (up to ten
accounts per profile by default). Enabling networks uses the ordinary discovery
flow; **Load networks** also retries discovery without reconnecting the device.

The app supports public data for 27 of the 28 Suite network symbols, including
Ledger Live paths for ETH, TRX and SOL. Cardano and Bitcoin CoinJoin are omitted.
BIP86 public keys can be exported, but Suite Taproot discovery is skipped
until an actual master fingerprint is available; no placeholder is used. The
special debug legacy EVM testnet path `44'/1'/0'/0/i` is not implemented.
Only Bitcoin BIP84 signing and device address verification are currently wired to
Suite's Ledger signer; accounts on other paths/networks are for discovery and
account viewing. The discovery app itself never signs.

Backend failures are isolated per network so the other networks can finish.
Suite keeps successful accounts and shows a discovery error when an enabled,
supported network fails. Use **Load networks** to retry after resolving a backend
failure. Send and device address verification are hidden for accounts unsupported
by the injected Ledger signer; receiving addresses can still be copied or shared.

Start the Flex emulator as documented in the firmware README, then run:

```sh
SPECULOS_API_URL=http://127.0.0.1:5001 yarn workspace @suite-common/ledger test:discovery:speculos
```

The test approves only a local emulator using the fixed public test mnemonic,
checks 49 exported records and profile conversions, verifies BTC/ETH known
addresses, and revokes export consent. It prints counts only.
