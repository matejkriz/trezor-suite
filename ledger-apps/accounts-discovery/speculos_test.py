"""Flex firmware regression checks against a local Speculos instance.

Run inside the pinned Ledger dev-tools image. The reference seed is public test
data; never use it on a funded device. No public account data is printed.
"""

import argparse
import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from Crypto.PublicKey import ECC
from ecpy.curves import Curve


SEED_WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
HARDENED = 0x80000000


def reference_path(profile, account):
    h = HARDENED
    if profile <= 8:
        return [h | [44, 49, 84, 86][(profile - 1) % 4], h | int(profile >= 5), h | account]
    if profile <= 11:
        return [h | [44, 49, 84][profile - 9], h | 2, h | account]
    if profile <= 14:
        return [h | 44, h | [3, 145, 133][profile - 12], h | account]
    return {
        15: [h | 44, h | 60, h, 0, account],
        16: [h | 44, h | 60, h | account, 0, 0],
        17: [h | 44, h | 60, h, account],
        18: [h | 44, h | 61, h, 0, account],
        19: [h | 44, h | 144, h | account, 0, 0],
        20: [h | 44, h | 195, h, 0, account],
        21: [h | 44, h | 195, h | account, 0, 0],
        22: [h | 44, h | 501, h | account, h],
        23: [h | 44, h | 501, h | account],
        24: [h | 44, h | 501],
        25: [h | 44, h | 148, h | account],
    }[profile]


def reference_record(profile, account):
    """Independent BIP32/SLIP-10 implementation, using host crypto libraries."""
    seed = hashlib.pbkdf2_hmac("sha512", SEED_WORDS.encode(), b"mnemonic", 2048)
    path = reference_path(profile, account)
    ed25519 = profile >= 22
    master = hmac.digest(b"ed25519 seed" if ed25519 else b"Bitcoin seed", seed, "sha512")
    private_key, chain_code = master[:32], master[32:]
    curve = Curve.get_curve("secp256k1")

    def public_key(key):
        if ed25519:
            return ECC.construct(curve="Ed25519", seed=key).public_key().export_key(format="raw")
        point = int.from_bytes(key, "big") * curve.generator
        return bytes([2 | (point.y & 1)]) + point.x.to_bytes(32, "big")

    parent_fingerprint = bytes(4)
    for index in path:
        parent = public_key(private_key)
        parent_fingerprint = hashlib.new("ripemd160", hashlib.sha256(parent).digest()).digest()[:4]
        source = b"\x00" + private_key if index & HARDENED else parent
        child = hmac.digest(chain_code, source + index.to_bytes(4, "big"), "sha512")
        if ed25519:
            private_key = child[:32]
        else:
            scalar = (int.from_bytes(child[:32], "big") + int.from_bytes(private_key, "big")) % curve.order
            assert scalar != 0
            private_key = scalar.to_bytes(32, "big")
        chain_code = child[32:]
    return (
        profile,
        public_key(private_key),
        bytes(32) if ed25519 else chain_code,
        bytes(4) if ed25519 else parent_fingerprint,
        path[-1],
        len(path),
    )


class Speculos:
    def __init__(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Tests must target a local Speculos HTTP API")
        self.url = url.rstrip("/")

    def request(self, path, payload=None, method=None):
        body = None if payload is None else json.dumps(payload).encode()
        request = Request(self.url + path, body, {"Content-Type": "application/json"}, method=method)
        with urlopen(request, timeout=30) as response:
            return json.load(response)

    def apdu(self, instruction, payload=b"", status=0x9000, cla=0xE1, p1=0, p2=0):
        packet = bytes([cla, instruction, p1, p2, len(payload)]) + payload
        response = bytes.fromhex(self.request("/apdu", {"data": packet.hex()})["data"])
        assert len(response) >= 2, "Missing APDU status"
        assert int.from_bytes(response[-2:], "big") == status, f"Unexpected status for INS {instruction:02x}"
        if status != 0x9000:
            assert response[:-2] == b"", "Error returned partial public data"
        return response[:-2]

    def choose(self, button, status):
        self.request("/events", method="DELETE")
        with ThreadPoolExecutor(max_workers=1) as executor:
            pending = executor.submit(self.apdu, 2, status=status)
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                events = self.request("/events")["events"]
                matches = [event for event in events if event["text"] == button]
                if matches:
                    event = matches[-1]
                    assert event["y"] + event["h"] <= 600, "Consent button is outside the Flex screen"
                    self.request("/finger", {
                        "action": "press-and-release",
                        "x": event["x"] + event["w"] // 2,
                        "y": event["y"] + event["h"] // 2,
                    })
                    pending.result(timeout=10)
                    return
                time.sleep(0.05)
            raise AssertionError("Device consent screen did not appear")

    def batch(self, requests, status=0x9000):
        payload = bytes([len(requests)]) + b"".join(
            bytes([profile]) + account.to_bytes(4, "big") + index.to_bytes(4, "big")
            for profile, account, index in requests
        )
        return self.apdu(3, payload, status)


def records(payload):
    count = payload[0]
    offset = 1
    result = []
    for _ in range(count):
        profile, key_length = payload[offset:offset + 2]
        assert key_length in {32, 33}
        offset += 2
        key = payload[offset:offset + key_length]
        offset += key_length
        chain_code = payload[offset:offset + 32]
        fingerprint = payload[offset + 32:offset + 36]
        child_index = int.from_bytes(payload[offset + 36:offset + 40], "big")
        depth = payload[offset + 40]
        offset += 41
        result.append((profile, key, chain_code, fingerprint, child_index, depth))
    assert offset == len(payload), "Malformed public-key record length"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5000")
    args = parser.parse_args()
    emulator = Speculos(args.url)
    info = bytes([0x41, 0x44, 1, 0, 1, 0, 1, 3, 25]) + bytes(range(1, 26))
    assert emulator.apdu(1) == info
    emulator.apdu(4)
    emulator.batch([(3, 0, 0)], 0x6985)
    emulator.apdu(1, cla=0xE0, status=0x6E00)
    emulator.apdu(6, status=0x6D00)
    emulator.apdu(0xFF, status=0x6D00)
    emulator.apdu(1, p1=1, status=0x6A86)
    for instruction in (1, 2, 4):
        emulator.apdu(instruction, b"\x01", 0x6700)
    emulator.choose("Reject", 0x6985)
    emulator.batch([(3, 0, 0)], 0x6985)
    emulator.choose("Allow discovery", 0x9000)

    mixed = [(3, 0, 0), (15, 0, 0), (22, 0, 0)]
    payload = emulator.batch(mixed)
    assert records(payload) == [reference_record(profile, account) for profile, account, _ in mixed]
    assert emulator.batch(mixed) == payload, "Repeated exports changed public account data"

    total_records = 0
    for account in (0, 7, 999):
        profiles = list(range(1, 26)) if account == 0 else [p for p in range(1, 26) if p != 24]
        for start in range(0, len(profiles), 3):
            requested = [(profile, account, 0) for profile in profiles[start:start + 3]]
            assert records(emulator.batch(requested)) == [reference_record(profile, account) for profile, _, _ in requested]
            total_records += len(requested)

    for payload in (b"", b"\x00", b"\x04" + bytes(36), b"\x01", b"\x01" + bytes(10)):
        emulator.apdu(3, payload, 0x6700)
    for profile in (0, 26, 255):
        emulator.batch([(3, 0, 0), (profile, 0, 0)], 0x6A80)
    for account in (1000, HARDENED, 0xFFFFFFFF):
        emulator.batch([(15, account, 0)], 0x6A80)
    emulator.batch([(15, 0, 1)], 0x6A80)
    emulator.batch([(24, 1, 0)], 0x6A80)
    emulator.apdu(4)
    emulator.batch(mixed, 0x6985)
    emulator.choose("Allow discovery", 0x9000)
    emulator.choose("Reject", 0x6985)
    emulator.batch(mixed, 0x6985)
    print(f"PASS: Flex consent, batching, {total_records} independent key vectors, and malformed/unsupported APDUs")


if __name__ == "__main__":
    main()
