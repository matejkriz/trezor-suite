# Ledger Bitcoin proof of concept

This package wraps Ledger Device Management Kit and Bitcoin Device Signer Kit. The transport is injected by each application: WebHID for Suite Web and Desktop, and React Native BLE for Suite Native. It derives the first BIP84 Bitcoin address, supports on-device address verification, and exposes PSBT signing to future wallet flows. The UI currently shows an address preview; Suite account discovery, history, and sending are not connected to Ledger sessions.

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
