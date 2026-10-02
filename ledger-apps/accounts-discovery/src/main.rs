#![no_std]
#![no_main]

mod profiles;

use ledger_device_sdk::ecc::{Ed25519, Secp256k1, SeedDerive};
use ledger_device_sdk::hash::{ripemd::Ripemd160, sha2::Sha2_256, HashInit};
use ledger_device_sdk::include_gif;
use ledger_device_sdk::io::{self, init_comm, ApduHeader, Command, Reply};
use ledger_device_sdk::nbgl::{NbglChoice, NbglGlyph, NbglHomeAndSettings};
use profiles::{derivation, Derivation, PROFILES};

ledger_device_sdk::set_panic!(ledger_device_sdk::exiting_panic);
ledger_device_sdk::define_comm!(COMM);

const ICON: NbglGlyph = NbglGlyph::from_include(include_gif!("icons/accounts_64.gif", NBGL));
const MAX_BATCH: usize = 3;

#[repr(u16)]
#[derive(Clone, Copy)]
enum Status {
    Ok = 0x9000,
    WrongLength = 0x6700,
    Denied = 0x6985,
    InvalidData = 0x6a80,
    WrongParameters = 0x6a86,
    UnsupportedInstruction = 0x6d00,
    InternalError = 0x6f00,
}

impl From<Status> for Reply {
    fn from(status: Status) -> Self {
        Reply(status as u16)
    }
}

impl From<io::CommError> for Status {
    fn from(_: io::CommError) -> Self {
        Self::InternalError
    }
}

enum Instruction {
    Info,
    OpenSession,
    PublicKeys,
    ResetSession,
}

impl TryFrom<ApduHeader> for Instruction {
    type Error = Status;
    fn try_from(header: ApduHeader) -> Result<Self, Status> {
        if header.p1 != 0 || header.p2 != 0 {
            return Err(Status::WrongParameters);
        }
        match header.ins {
            1 => Ok(Self::Info),
            2 => Ok(Self::OpenSession),
            3 => Ok(Self::PublicKeys),
            4 => Ok(Self::ResetSession),
            _ => Err(Status::UnsupportedInstruction),
        }
    }
}

fn home(approved: bool) -> NbglHomeAndSettings {
    NbglHomeAndSettings::new()
        .glyph(&ICON)
        .infos(
            "Accounts Discovery",
            env!("CARGO_PKG_VERSION"),
            "Suite contributors",
        )
        .tagline(if approved {
            "Public export approved. Quit to revoke access."
        } else {
            "Discover accounts in Trezor Suite. No signing."
        })
}

fn compress_secp(public_key: &[u8; 65]) -> [u8; 33] {
    let mut compressed = [0; 33];
    compressed[0] = 2 | (public_key[64] & 1);
    compressed[1..].copy_from_slice(&public_key[1..33]);
    compressed
}

fn fingerprint(path: &[u32]) -> Result<[u8; 4], Status> {
    let (private_key, _) = Secp256k1::derive_from(path);
    let public_key = private_key
        .public_key()
        .map_err(|_| Status::InternalError)?;
    drop(private_key);
    let compressed = compress_secp(&public_key.pubkey);
    let mut sha = [0; 32];
    let mut hash160 = [0; 20];
    Sha2_256::new()
        .hash(&compressed, &mut sha)
        .map_err(|_| Status::InternalError)?;
    Ripemd160::new()
        .hash(&sha, &mut hash160)
        .map_err(|_| Status::InternalError)?;
    Ok([hash160[0], hash160[1], hash160[2], hash160[3]])
}

fn append_key(response: &mut io::CommandResponse<'_>, request: &Derivation) -> Result<(), Status> {
    let path = &request.path[..request.depth];
    response.append(&[request.profile])?;
    if request.ed25519 {
        let private_key = Ed25519::derive_from_path_slip10(path);
        let public_key = private_key
            .public_key()
            .map_err(|_| Status::InternalError)?;
        drop(private_key);
        let mut encoded = [0; 32];
        for (i, byte) in encoded.iter_mut().enumerate() {
            *byte = public_key.pubkey[64 - i];
        }
        encoded[31] = (encoded[31] & 0x7f) | ((public_key.pubkey[32] & 1) << 7);
        response.append(&[32])?;
        response.append(&encoded)?;
        response.append(&[0; 36])?;
    } else {
        let (private_key, chain_code) = Secp256k1::derive_from(path);
        let public_key = private_key
            .public_key()
            .map_err(|_| Status::InternalError)?;
        drop(private_key);
        let compressed = compress_secp(&public_key.pubkey);
        response.append(&[33])?;
        response.append(&compressed)?;
        response.append(&chain_code.ok_or(Status::InternalError)?.value)?;
        response.append(&fingerprint(&path[..path.len() - 1])?)?;
    }
    response.append(&path[path.len() - 1].to_be_bytes())?;
    response.append(&[request.depth as u8])?;
    Ok(())
}

fn handle<'a>(
    command: Command<'a>,
    instruction: Instruction,
    approved: &mut bool,
) -> Result<io::CommandResponse<'a>, Status> {
    let data = command.get_data();
    match instruction {
        Instruction::Info => {
            if !data.is_empty() {
                return Err(Status::WrongLength);
            }
            let mut response = command.into_response();
            response.append(&[
                0x41,
                0x44,
                1,
                0,
                1,
                0,
                1,
                MAX_BATCH as u8,
                PROFILES.len() as u8,
            ])?;
            response.append(&PROFILES)?;
            Ok(response)
        }
        Instruction::OpenSession => {
            if !data.is_empty() {
                return Err(Status::WrongLength);
            }
            *approved = false;
            let comm = command.into_comm();
            *approved = NbglChoice::new().glyph(&ICON).show(
                comm,
                "Share public account data?",
                "All supported Suite networks: BTC, LTC, DOGE, BCH, ZEC, EVM, XRP, TRX, SOL, XLM. Public keys reveal balances and history. No signing or private key export.",
                "Allow discovery",
                "Reject",
            );
            home(*approved).show_and_return();
            if !*approved {
                return Err(Status::Denied);
            }
            Ok(comm.begin_response())
        }
        Instruction::ResetSession => {
            if !data.is_empty() {
                return Err(Status::WrongLength);
            }
            *approved = false;
            home(false).show_and_return();
            Ok(command.into_response())
        }
        Instruction::PublicKeys => {
            if !*approved {
                return Err(Status::Denied);
            }
            let count = *data.first().ok_or(Status::WrongLength)? as usize;
            if count == 0 || count > MAX_BATCH || data.len() != 1 + count * 9 {
                return Err(Status::WrongLength);
            }
            let mut requests: [Option<Derivation>; MAX_BATCH] = [None; MAX_BATCH];
            for (i, request) in requests[..count].iter_mut().enumerate() {
                let start = 1 + i * 9;
                let account = u32::from_be_bytes(
                    data[start + 1..start + 5]
                        .try_into()
                        .map_err(|_| Status::WrongLength)?,
                );
                let index = u32::from_be_bytes(
                    data[start + 5..start + 9]
                        .try_into()
                        .map_err(|_| Status::WrongLength)?,
                );
                *request =
                    Some(derivation(data[start], account, index).ok_or(Status::InvalidData)?);
            }
            let mut response = command.into_response();
            response.append(&[count as u8])?;
            for request in requests[..count].iter().flatten() {
                append_key(&mut response, request)?;
            }
            Ok(response)
        }
    }
}

#[no_mangle]
extern "C" fn sample_main(_: u32) {
    let comm = init_comm(&COMM);
    comm.set_expected_cla(0xe1);
    let mut approved = false;
    home(false).show_and_return();
    loop {
        let command = comm.next_command();
        let instruction = match command.decode::<Instruction>() {
            Ok(instruction) => instruction,
            Err(status) => {
                let _ = comm.send(&[], status);
                continue;
            }
        };
        match handle(command, instruction, &mut approved) {
            Ok(response) => {
                let _ = response.send(Status::Ok);
            }
            Err(status) => {
                let _ = comm.send(&[], status);
            }
        }
    }
}
