# Ledger Bitcoin proof of concept

This package wraps Ledger Device Management Kit and Bitcoin Device Signer Kit. The transport is injected by each application: WebHID for Suite Web and Desktop, and React Native BLE for Suite Native. It derives BIP84 Bitcoin accounts, supports on-device address verification, and signs Bitcoin transactions through PSBT. Suite Web and Desktop store connected Ledger wallets in the regular device and account state and use the existing account, receive, and send screens.

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
docker run --rm -p 127.0.0.1:5000:5000 -v /tmp/ledger-app-bitcoin/bin/app.elf:/app/app.elf:ro ghcr.io/ledgerhq/speculos:latest --model nanosp --display headless --api-port 5000 /app/app.elf
yarn workspace @suite-common/ledger test:speculos
```

The smoke test checks account path, xpub format, and native SegWit address format without printing wallet data.
