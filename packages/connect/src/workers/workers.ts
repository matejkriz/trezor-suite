import type { BaseWorker } from '@trezor/blockchain-link/src/workers/baseWorker';

type WorkerAsyncImporter = () => Promise<BaseWorker<unknown>>;

const BlockbookWorker: WorkerAsyncImporter = () =>
    import(
        /* webpackChunkName: "blockbook-worker" */ '@trezor/blockchain-link/src/workers/blockbook'
    ).then(w => w.default());
const RippleWorker: WorkerAsyncImporter = () =>
    import(
        /* webpackChunkName: "ripple-worker" */ '@trezor/blockchain-link/src/workers/ripple'
    ).then(w => w.default());
const BlockfrostWorker: WorkerAsyncImporter = () =>
    import(
        /* webpackChunkName: "blockfrost-worker" */ '@trezor/blockchain-link/src/workers/blockfrost'
    ).then(w => w.default());
const ElectrumWorker: WorkerAsyncImporter = () =>
    import(
        /* webpackChunkName: "electrum-worker" */ '@trezor/blockchain-link/src/workers/electrum'
    ).then(w => w.default());
const SolanaWorker: WorkerAsyncImporter = () =>
    import(
        /* webpackChunkName: "solana-worker" */ '@trezor/blockchain-link/src/workers/solana'
    ).then(w => w.default());

export { BlockbookWorker, RippleWorker, BlockfrostWorker, ElectrumWorker, SolanaWorker };
