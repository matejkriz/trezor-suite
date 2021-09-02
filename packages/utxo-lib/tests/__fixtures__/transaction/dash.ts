export default {
    valid: [
        {
            description: 'Version 2-of-3 transaction',
            hex: '0100000001f5ab73237b3f4d66cea19da22b71fe0f0b14bdf80fed874cc021e67792be1ea401000000fdfd000047304402200eb46dbcd3841812dead7bd10d39f788fea15d370983d40227fc8eb51129b97702201a50e69635f6b59a8b9d0a75c62e85e47dfea523acd468a61a8b40f4834d010e01483045022100c23127008a3398743b4406bd3bde0b9c45b04765ccf9fb3909be7ee44f6c01e20220158a783b09d2f0786b6aa42d6a016ad2ebffeda7ce2c2c70361001752bc825f0014c6952210274c85e17fcc77395afd6ba1362a7316089f3807b84d06c5ace7aeb3ed2c7dbdd2102c115d981cafec0cc0d10a38255c51f06fcedef6f776429716ca4a16b0e43a71a21024c9674e1880d128f7e942cee753935642838656415663da7af890a3224b9249253aeffffffff0200bc8dce0000000017a914d356232afc6edba5c0989311ebc2b80e01f43c6587a0860100000000001976a9142fd0e16c05bbbcdc388d4807b5cbe5f45389eb2d88acf57c0200',
            txid: '60dbffb35e521bd902bce3c070ca20f1c0fef4279a21a53d8cb00523e992ad11',
            size: 372,
            version: 1,
            locktime: 163061,
            vin: [
                {
                    txid: 'a41ebe9277e621c04c87ed0ff8bd140b0ffe712ba29da1ce664d3f7b2373abf5',
                    vout: 1,
                    scriptSig: {
                        asm: '0 304402200eb46dbcd3841812dead7bd10d39f788fea15d370983d40227fc8eb51129b97702201a50e69635f6b59a8b9d0a75c62e85e47dfea523acd468a61a8b40f4834d010e[ALL] 3045022100c23127008a3398743b4406bd3bde0b9c45b04765ccf9fb3909be7ee44f6c01e20220158a783b09d2f0786b6aa42d6a016ad2ebffeda7ce2c2c70361001752bc825f0[ALL] 52210274c85e17fcc77395afd6ba1362a7316089f3807b84d06c5ace7aeb3ed2c7dbdd2102c115d981cafec0cc0d10a38255c51f06fcedef6f776429716ca4a16b0e43a71a21024c9674e1880d128f7e942cee753935642838656415663da7af890a3224b9249253ae',
                        hex: '0047304402200eb46dbcd3841812dead7bd10d39f788fea15d370983d40227fc8eb51129b97702201a50e69635f6b59a8b9d0a75c62e85e47dfea523acd468a61a8b40f4834d010e01483045022100c23127008a3398743b4406bd3bde0b9c45b04765ccf9fb3909be7ee44f6c01e20220158a783b09d2f0786b6aa42d6a016ad2ebffeda7ce2c2c70361001752bc825f0014c6952210274c85e17fcc77395afd6ba1362a7316089f3807b84d06c5ace7aeb3ed2c7dbdd2102c115d981cafec0cc0d10a38255c51f06fcedef6f776429716ca4a16b0e43a71a21024c9674e1880d128f7e942cee753935642838656415663da7af890a3224b9249253ae',
                    },
                    sequence: 4294967295,
                },
            ],
            vout: [
                {
                    value: 34.653952,
                    valueSat: 3465395200,
                    n: 0,
                    scriptPubKey: {
                        asm: 'OP_HASH160 d356232afc6edba5c0989311ebc2b80e01f43c65 OP_EQUAL',
                        hex: 'a914d356232afc6edba5c0989311ebc2b80e01f43c6587',
                        reqSigs: 1,
                        type: 'scripthash',
                        addresses: ['8yguUUD2vMuGMLfYJCe9fwBtFWc4Dyjizj'],
                    },
                },
                {
                    value: 0.001,
                    valueSat: 100000,
                    n: 1,
                    scriptPubKey: {
                        asm: 'OP_DUP OP_HASH160 2fd0e16c05bbbcdc388d4807b5cbe5f45389eb2d OP_EQUALVERIFY OP_CHECKSIG',
                        hex: '76a9142fd0e16c05bbbcdc388d4807b5cbe5f45389eb2d88ac',
                        reqSigs: 1,
                        type: 'pubkeyhash',
                        addresses: ['yQgGqVdasi5jGfweJ84HJz4qp4ac5G2gxG'],
                    },
                },
            ],
            blockhash: '00000000d2513c07d434a1a39c7df210181968ec24ce5b07a5baf860ca440f10',
            height: 163064,
            confirmations: 28048,
            time: 1530821961,
            blocktime: 1530821961,
            extraData: undefined,
        },
        {
            description: 'Coinbase Special transaction',
            url_comment:
                'https://testnet-insight.dashevo.org/insight-api/tx/7dc0635c2aee2eb002854ea0b3333b7272db73685d87fc322aa1d8694ba8b05d',
            hex: '03000500010000000000000000000000000000000000000000000000000000000000000000ffffffff270350c3001a4d696e656420627920416e74506f6f6c20ae001500208a4c32f70000000052010000ffffffff02408e5338000000001976a914bb5ad5fce0d6fd6c682a76ba5a150bf8a799725888ac408e5338000000001976a914884b39e7de5d989a2a7699bf50113107ddc72fed88ac0000000026010050c30000b4f3b6d1f4e2a398a7f9bea310d5f65f54862ec3b74cd4bc1543ebb0dd9c19d2',
            txid: '7dc0635c2aee2eb002854ea0b3333b7272db73685d87fc322aa1d8694ba8b05d',
            version: 3,
            type: 5,
            locktime: 0,
            extraPayloadSize: 38,
            extraPayload:
                '010050c30000b4f3b6d1f4e2a398a7f9bea310d5f65f54862ec3b74cd4bc1543ebb0dd9c19d2',
            vin: [
                {
                    coinbase:
                        '0350c3001a4d696e656420627920416e74506f6f6c20ae001500208a4c32f70000000052010000',
                    sequence: 4294967295,
                    n: 0,
                },
            ],
            vout: [
                {
                    value: 9.45,
                    n: 0,
                    scriptPubKey: {
                        hex: '76a914bb5ad5fce0d6fd6c682a76ba5a150bf8a799725888ac',
                        asm: 'OP_DUP OP_HASH160 bb5ad5fce0d6fd6c682a76ba5a150bf8a7997258 OP_EQUALVERIFY OP_CHECKSIG',
                        addresses: ['ydQ62TqsGEAFPAreA1EvovrfNmLmXdnfZt'],
                        type: 'pubkeyhash',
                    },
                },
                {
                    value: 9.45,
                    n: 1,
                    scriptPubKey: {
                        hex: '76a914884b39e7de5d989a2a7699bf50113107ddc72fed88ac',
                        asm: 'OP_DUP OP_HASH160 884b39e7de5d989a2a7699bf50113107ddc72fed OP_EQUALVERIFY OP_CHECKSIG',
                        addresses: ['yYk6s6jKgXCQ3Mue3Xw5nHir7D8fmnCEh2'],
                        type: 'pubkeyhash',
                    },
                },
            ],
            blockhash: '0000000000d737f4b6f0fcd10ecd2f59e5e4f9409b1afae5fb50604510a2551f',
            blockheight: 50000,
            confirmations: 2360,
            time: 1550935893,
            blocktime: 1550935893,
            isCoinBase: true,
            valueOut: 18.9,
            size: 197,
            txlock: false,
            cbTx: {
                version: 1,
                height: 50000,
                merkleRootMNList:
                    'd2199cddb0eb4315bcd44cb7c32e86545ff6d510a3bef9a798a3e2f4d1b6f3b4',
            },
            extraData:
                '26010050c30000b4f3b6d1f4e2a398a7f9bea310d5f65f54862ec3b74cd4bc1543ebb0dd9c19d2',
        },
        {
            description: 'ProRegTx',
            url_comment:
                'https://github.com/dashevo/dashcore-lib/blob/master/test/fixtures/payload/proregtxpayload.js',
            hex: '030001000126d3cb36b5360a23f5f4a2ea4c98d385c0c7a80788439f52a237717d799356a6000000006b483045022100b025cd823cf6b746e97a1e5657c1c6f150bc63530734b1c5dacef2cfad53a8ea022073d0801e18a082eaee70838f2cfc19c78b88b879af7d3e42023d61852ad289e701210222865251150a58f0f89602cb812046cc38c84d67e3dc74edb9061aaed19c2bdefeffffff0143c94fbb000000001976a9145cbfea4a74cfeb5f801f2cbaf38a9bac7ebebb0e88ac00000000fd120101000000000026d3cb36b5360a23f5f4a2ea4c98d385c0c7a80788439f52a237717d799356a60100000000000000000000000000ffffc38d008f4e1f8a94fb062049b841f716dcded8257a3632fb053c8273ec203d1ea62cbdb54e10618329e4ed93e99bc9c5ab2f4cb0055ad281f9ad0808a1dda6aedf12c41c53142828879b8a94fb062049b841f716dcded8257a3632fb053c00001976a914e4876df5735eaa10a761dca8d62a7a275349022188acbc1055e0331ea0ea63caf80e0a7f417e50df6469a97db1f4f1d81990316a5e0b412045323bca7defef188065a6b30fb3057e4978b4f914e4e8cc0324098ae60ff825693095b927cd9707fe10edbf8ef901fcbc63eb9a0e7cd6fed39d50a8cde1cdb4',
            txid: '62330c04f20acc541c8d4f3022ba2b032ea5530c476e61dc9c4235ac20d10f4f',
            size: 469,
            version: 3,
            type: 1,
            locktime: 0,
            extraPayloadSize: 274,
            extraPayload:
                '01000000000026d3cb36b5360a23f5f4a2ea4c98d385c0c7a80788439f52a237717d799356a60100000000000000000000000000ffffc38d008f4e1f8a94fb062049b841f716dcded8257a3632fb053c8273ec203d1ea62cbdb54e10618329e4ed93e99bc9c5ab2f4cb0055ad281f9ad0808a1dda6aedf12c41c53142828879b8a94fb062049b841f716dcded8257a3632fb053c00001976a914e4876df5735eaa10a761dca8d62a7a275349022188acbc1055e0331ea0ea63caf80e0a7f417e50df6469a97db1f4f1d81990316a5e0b412045323bca7defef188065a6b30fb3057e4978b4f914e4e8cc0324098ae60ff825693095b927cd9707fe10edbf8ef901fcbc63eb9a0e7cd6fed39d50a8cde1cdb4',
            vin: [
                {
                    txid: 'a65693797d7137a2529f438807a8c7c085d3984ceaa2f4f5230a36b536cbd326',
                    vout: 0,
                    scriptSig: {
                        asm: '3045022100b025cd823cf6b746e97a1e5657c1c6f150bc63530734b1c5dacef2cfad53a8ea022073d0801e18a082eaee70838f2cfc19c78b88b879af7d3e42023d61852ad289e7[ALL]0222865251150a58f0f89602cb812046cc38c84d67e3dc74edb9061aaed19c2bde',
                        hex: '483045022100b025cd823cf6b746e97a1e5657c1c6f150bc63530734b1c5dacef2cfad53a8ea022073d0801e18a082eaee70838f2cfc19c78b88b879af7d3e42023d61852ad289e701210222865251150a58f0f89602cb812046cc38c84d67e3dc74edb9061aaed19c2bde',
                    },
                    sequence: 4294967294,
                },
            ],
            vout: [
                {
                    value: 31.42568259,
                    valueSat: 3142568259,
                    n: 0,
                    scriptPubKey: {
                        asm: 'OP_DUP OP_HASH160 5cbfea4a74cfeb5f801f2cbaf38a9bac7ebebb0e OP_EQUALVERIFY OP_CHECKSIG',
                        hex: '76a9145cbfea4a74cfeb5f801f2cbaf38a9bac7ebebb0e88ac',
                        reqSigs: 1,
                        type: 'pubkeyhash',
                        addresses: ['yUmrvMSVw2iKVVVfarMASnBRtdfvX6MLFr'],
                    },
                },
            ],
            proRegTx: {
                version: 1,
                collateralHash: 'a65693797d7137a2529f438807a8c7c085d3984ceaa2f4f5230a36b536cbd326',
                collateralIndex: 1,
                service: '195.141.0.143:19999',
                keyIDOwner: '3c05fb32367a25d8dedc16f741b8492006fb948a',
                pubKeyOperator:
                    '8273ec203d1ea62cbdb54e10618329e4ed93e99bc9c5ab2f4cb0055ad281f9ad0808a1dda6aedf12c41c53142828879b',
                keyIDVoting: '3c05fb32367a25d8dedc16f741b8492006fb948a',
                payoutAddress: 'yh9o9kPRK1s3YsuyCBe3DEjBit2RnzhgwH',
                operatorReward: 0,
                inputsHash: '0b5e6a319019d8f1f4b17da96964df507e417f0a0ef8ca63eaa01e33e05510bc',
            },
            instantlock: false,
            extraData:
                'fd120101000000000026d3cb36b5360a23f5f4a2ea4c98d385c0c7a80788439f52a237717d799356a60100000000000000000000000000ffffc38d008f4e1f8a94fb062049b841f716dcded8257a3632fb053c8273ec203d1ea62cbdb54e10618329e4ed93e99bc9c5ab2f4cb0055ad281f9ad0808a1dda6aedf12c41c53142828879b8a94fb062049b841f716dcded8257a3632fb053c00001976a914e4876df5735eaa10a761dca8d62a7a275349022188acbc1055e0331ea0ea63caf80e0a7f417e50df6469a97db1f4f1d81990316a5e0b412045323bca7defef188065a6b30fb3057e4978b4f914e4e8cc0324098ae60ff825693095b927cd9707fe10edbf8ef901fcbc63eb9a0e7cd6fed39d50a8cde1cdb4',
        },
    ],
};
