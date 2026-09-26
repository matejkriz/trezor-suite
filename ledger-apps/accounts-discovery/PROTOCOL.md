# Accounts Discovery protocol 1

This application only exports public account data. It cannot sign, export a seed or
private key, change device settings, or derive a caller-supplied arbitrary path.
It does not scan a blockchain. Suite obtains public data here, then uses its normal
network backends for adaptive account discovery.

## Transport

Short APDUs: `[CLA, INS, P1, P2, Lc, ...data]`. CLA is `E1`, P1/P2 are `00`.
There is no Le field. Responses end with a two-byte big endian status word.
One USB/BLE session and one open application cover every supported network; no
switching between network applications is necessary for discovery.

| INS  | Command         | Request     | Successful response                 |
| ---- | --------------- | ----------- | ----------------------------------- |
| `01` | GET_INFO        | Empty       | Metadata below                      |
| `02` | OPEN_SESSION    | Empty       | Empty, after approval on the device |
| `03` | GET_PUBLIC_KEYS | Batch below | Public-key records below            |
| `04` | RESET_SESSION   | Empty       | Empty; revokes approval             |

GET_INFO is public. OPEN_SESSION revokes previous consent before showing the
explicit permission prompt. Rejecting returns `6985` and leaves exports disabled.
The approval lives in volatile memory while this app remains open. RESET_SESSION
or quitting/restarting the app revokes it. USB disconnection alone is not a
revocation mechanism: quit the app to revoke from the device independently of the
host. A reconnecting host must request consent again.

### GET_INFO

`41 44 01 00 01 00 01 03 19` followed by IDs `01` through `19` (decimal 1–25).

| Offset | Length | Meaning                                                      |
| ------ | ------ | ------------------------------------------------------------ |
| 0      | 2      | Magic ASCII `AD`                                             |
| 2      | 1      | Protocol version `1`                                         |
| 3      | 3      | App semantic version `0.1.0`                                 |
| 6      | 1      | Flags: bit 0 means device approval required; other bits zero |
| 7      | 1      | Maximum records per batch `3`                                |
| 8      | 1      | Number of supported profiles `25`                            |
| 9      | 25     | Profile IDs                                                  |

### GET_PUBLIC_KEYS

Request: `count:u8` followed by `count` tuples of
`profile:u8, account:u32be, addressIndex:u32be`. Count must be 1–3. Account is
0–999. `addressIndex` is reserved and must be zero. **Every tuple is validated
before any derivation.** Unknown profiles, unsafe indexes and nonzero reserved
indexes return `6A80`; no partial records are sent.

Response: `count:u8` followed by records:
`profile:u8, keyLength:u8, publicKey:32|33, chainCode:32,
parentFingerprint:4, childIndex:u32be, depth:u8`.

Secp256k1 public keys are compressed SEC1 (33 bytes). Chain code, parent
fingerprint and last path element are sufficient to serialize the requested BIP32
node; no master fingerprint or root key is exported. For address-based profiles,
the host expands the compressed point and applies the network address encoding.
Ed25519 keys are standard compressed 32-byte Edwards points. Ed25519 chain code
and parent fingerprint are zero placeholders, **not** an extended public key.
Ed25519 hosts must use only the public key for address encoding. Child/depth
metadata still describe the actual requested path. Maximum response is 229 bytes
plus the status word (three secp256k1 records).

## Allowlisted profiles

Here `i` is the request's `account`, `'` means hardened, and `addressIndex=0`.
Testnet BTC profiles cover Suite's testnet and regtest using network-specific
host-side xpub/address versions. EVM networks and tokens share ETH keys rather
than introducing networks absent from Suite.

| ID  | Profile                   | Path                               |
| --- | ------------------------- | ---------------------------------- |
| 1   | BTC legacy                | `m/44'/0'/i'`                      |
| 2   | BTC nested SegWit         | `m/49'/0'/i'`                      |
| 3   | BTC native SegWit         | `m/84'/0'/i'`                      |
| 4   | BTC Taproot               | `m/86'/0'/i'`                      |
| 5   | BTC test legacy           | `m/44'/1'/i'`                      |
| 6   | BTC test nested SegWit    | `m/49'/1'/i'`                      |
| 7   | BTC test native SegWit    | `m/84'/1'/i'`                      |
| 8   | BTC test Taproot          | `m/86'/1'/i'`                      |
| 9   | LTC legacy                | `m/44'/2'/i'`                      |
| 10  | LTC nested SegWit         | `m/49'/2'/i'`                      |
| 11  | LTC native SegWit         | `m/84'/2'/i'`                      |
| 12  | DOGE                      | `m/44'/3'/i'`                      |
| 13  | BCH                       | `m/44'/145'/i'`                    |
| 14  | ZEC transparent           | `m/44'/133'/i'`                    |
| 15  | ETH Suite                 | `m/44'/60'/0'/0/i`                 |
| 16  | ETH Ledger Live           | `m/44'/60'/i'/0/0`                 |
| 17  | ETH legacy                | `m/44'/60'/0'/i`                   |
| 18  | ETC Suite                 | `m/44'/61'/0'/0/i`                 |
| 19  | XRP                       | `m/44'/144'/i'/0/0`                |
| 20  | TRX Suite                 | `m/44'/195'/0'/0/i`                |
| 21  | TRX Ledger Live           | `m/44'/195'/i'/0/0`                |
| 22  | SOL Suite (SLIP-10)       | `m/44'/501'/i'/0'`                 |
| 23  | SOL Ledger Live (SLIP-10) | `m/44'/501'/i'`                    |
| 24  | SOL root (SLIP-10)        | `m/44'/501'`, account must be zero |
| 25  | XLM (SLIP-10)             | `m/44'/148'/i'`                    |

Cardano is intentionally absent. Its Ledger BIP32-Ed25519 extended key derivation
is different from SLIP-10; a normal Ed25519 key would silently discover the wrong
wallet. Supporting it requires a separate verified implementation and profile.
Zcash shielded keys are not exported: Suite uses transparent account discovery.

## Errors

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `9000` | Success                                                  |
| `6700` | Incorrect request length or batch size                   |
| `6985` | Public export not approved or permission rejected        |
| `6A80` | Invalid/unsupported profile or account/index             |
| `6A86` | P1 or P2 is not zero                                     |
| `6D00` | Unsupported instruction (including signing instructions) |
| `6E00` | Unsupported CLA                                          |
| `6F00` | Derivation, hashing or I/O failure                       |
