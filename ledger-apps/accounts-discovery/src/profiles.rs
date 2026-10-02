pub const HARDENED: u32 = 0x8000_0000;
pub const MAX_ACCOUNT: u32 = 999;
pub const PROFILES: [u8; 25] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
];

#[derive(Clone, Copy)]
pub struct Derivation {
    pub profile: u8,
    pub path: [u32; 5],
    pub depth: usize,
    pub ed25519: bool,
}

pub fn derivation(profile: u8, account: u32, address_index: u32) -> Option<Derivation> {
    if account > MAX_ACCOUNT || address_index != 0 {
        return None;
    }
    let hardened_account = account | HARDENED;
    let h = HARDENED;
    let (path, depth, ed25519) = match profile {
        1..=8 => {
            let purpose = [44, 49, 84, 86][(profile as usize - 1) % 4];
            let coin = u32::from(profile >= 5);
            ([purpose | h, coin | h, hardened_account, 0, 0], 3, false)
        }
        9..=11 => {
            let purpose = [44, 49, 84][profile as usize - 9];
            ([purpose | h, 2 | h, hardened_account, 0, 0], 3, false)
        }
        12..=14 => {
            let coin = [3, 145, 133][profile as usize - 12];
            ([44 | h, coin | h, hardened_account, 0, 0], 3, false)
        }
        15 => ([44 | h, 60 | h, h, 0, account], 5, false),
        16 => ([44 | h, 60 | h, hardened_account, 0, 0], 5, false),
        17 => ([44 | h, 60 | h, h, account, 0], 4, false),
        18 => ([44 | h, 61 | h, h, 0, account], 5, false),
        19 => ([44 | h, 144 | h, hardened_account, 0, 0], 5, false),
        20 => ([44 | h, 195 | h, h, 0, account], 5, false),
        21 => ([44 | h, 195 | h, hardened_account, 0, 0], 5, false),
        22 => ([44 | h, 501 | h, hardened_account, h, 0], 4, true),
        23 => ([44 | h, 501 | h, hardened_account, 0, 0], 3, true),
        24 if account == 0 => ([44 | h, 501 | h, 0, 0, 0], 2, true),
        25 => ([44 | h, 148 | h, hardened_account, 0, 0], 3, true),
        _ => return None,
    };
    Some(Derivation {
        profile,
        path,
        depth,
        ed25519,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suite_paths_match_the_network_contract() {
        let h = HARDENED;
        let expected = [
            (1, [44 | h, h, 7 | h, 0, 0], 3, false),
            (2, [49 | h, h, 7 | h, 0, 0], 3, false),
            (3, [84 | h, h, 7 | h, 0, 0], 3, false),
            (4, [86 | h, h, 7 | h, 0, 0], 3, false),
            (5, [44 | h, 1 | h, 7 | h, 0, 0], 3, false),
            (6, [49 | h, 1 | h, 7 | h, 0, 0], 3, false),
            (7, [84 | h, 1 | h, 7 | h, 0, 0], 3, false),
            (8, [86 | h, 1 | h, 7 | h, 0, 0], 3, false),
            (9, [44 | h, 2 | h, 7 | h, 0, 0], 3, false),
            (10, [49 | h, 2 | h, 7 | h, 0, 0], 3, false),
            (11, [84 | h, 2 | h, 7 | h, 0, 0], 3, false),
            (12, [44 | h, 3 | h, 7 | h, 0, 0], 3, false),
            (13, [44 | h, 145 | h, 7 | h, 0, 0], 3, false),
            (14, [44 | h, 133 | h, 7 | h, 0, 0], 3, false),
            (15, [44 | h, 60 | h, h, 0, 7], 5, false),
            (16, [44 | h, 60 | h, 7 | h, 0, 0], 5, false),
            (17, [44 | h, 60 | h, h, 7, 0], 4, false),
            (18, [44 | h, 61 | h, h, 0, 7], 5, false),
            (19, [44 | h, 144 | h, 7 | h, 0, 0], 5, false),
            (20, [44 | h, 195 | h, h, 0, 7], 5, false),
            (21, [44 | h, 195 | h, 7 | h, 0, 0], 5, false),
            (22, [44 | h, 501 | h, 7 | h, h, 0], 4, true),
            (23, [44 | h, 501 | h, 7 | h, 0, 0], 3, true),
            (25, [44 | h, 148 | h, 7 | h, 0, 0], 3, true),
        ];
        for (profile, path, depth, ed25519) in expected {
            let request = derivation(profile, 7, 0).expect("Supported profile");
            assert_eq!(request.path, path, "Profile {profile}");
            assert_eq!(request.depth, depth);
            assert_eq!(request.ed25519, ed25519);
        }
        let root = derivation(24, 0, 0).expect("Solana root");
        assert_eq!(&root.path[..root.depth], &[44 | h, 501 | h]);
    }

    #[test]
    fn malformed_and_unlisted_requests_cannot_reach_derivation() {
        assert!(derivation(0, 0, 0).is_none());
        assert!(derivation(26, 0, 0).is_none());
        assert!(derivation(255, 0, 0).is_none());
        for profile in PROFILES {
            assert!(derivation(profile, 0, 1).is_none());
            assert!(derivation(profile, 1000, 0).is_none());
            assert!(derivation(profile, HARDENED, 0).is_none());
            assert!(derivation(profile, u32::MAX, 0).is_none());
        }
        assert!(derivation(24, 1, 0).is_none());
        assert!(derivation(24, MAX_ACCOUNT, 0).is_none());
    }

    #[test]
    fn all_advertised_profiles_are_valid_and_hardened_ed25519_only() {
        for profile in PROFILES {
            let request = derivation(profile, 0, 0).expect("Advertised profile");
            assert!(request.depth >= 2 && request.depth <= 5);
            if request.ed25519 {
                assert!(request.path[..request.depth]
                    .iter()
                    .all(|index| index & HARDENED != 0));
            }
        }
    }
}
