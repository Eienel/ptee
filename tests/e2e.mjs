/**
 * End-to-end reclaim against a local validator running the REAL deployed Token
 * Program binary (tests/fixtures/token.so, dumped from mainnet).
 *
 *   npm run test:e2e     (starts and stops the validator itself)
 *
 * Set RPC_URL to point at devnet with a funded FEE_PAYER instead.
 */
import assert from 'node:assert/strict';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccount,
  createMint,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  mintTo,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createWithdrawExcessLamportsInstruction } from './.withdraw.mjs';

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899';
const connection = new Connection(RPC_URL, 'confirmed');

const payer = Keypair.generate();
const sig = await connection.requestAirdrop(payer.publicKey, 5 * LAMPORTS_PER_SOL);
await connection.confirmTransaction({ signature: sig, ...(await connection.getLatestBlockhash()) });

const SURPLUS = 1_500_000; // what an account funded at an older rent rate carries

async function overfund(account) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: account,
      lamports: SURPLUS,
    }),
  );
  await connection.sendTransaction(tx, [payer]);
  await new Promise((r) => setTimeout(r, 800));
}

async function reclaim(source) {
  const tx = new Transaction().add(
    createWithdrawExcessLamportsInstruction({
      source,
      destination: payer.publicKey,
      authority: payer.publicKey,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  return connection.sendTransaction(tx, [payer], { preflightCommitment: 'confirmed' });
}

const floorFor = (len) => connection.getMinimumBalanceForRentExemption(len);
const lamportsOf = async (key) => (await connection.getAccountInfo(key)).lamports;

console.log(`RPC ${RPC_URL}`);
const mint = await createMint(connection, payer, payer.publicKey, null, 6);
const ata = await createAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
await mintTo(connection, payer, mint, ata, payer, 1_000_000n);
console.log(`mint ${mint.toBase58()}\nata  ${ata.toBase58()}`);

// --- 1. token account --------------------------------------------------------
{
  await overfund(ata);
  const floor = await floorFor(165);
  const before = await lamportsOf(ata);
  assert.equal(before, floor + SURPLUS, 'account is over-funded before the reclaim');
  const destBefore = await lamportsOf(payer.publicKey);

  const signature = await reclaim(ata);
  await connection.confirmTransaction(
    { signature, ...(await connection.getLatestBlockhash()) },
    'confirmed',
  );

  const after = await connection.getParsedAccountInfo(ata);
  assert.equal(after.value.lamports, floor, 'source left at exactly the rent floor');
  assert.equal(
    after.value.data.parsed.info.tokenAmount.amount,
    '1000000',
    'token balance untouched',
  );
  const destAfter = await lamportsOf(payer.publicKey);
  assert.ok(destAfter > destBefore, 'destination gained lamports (net of fees)');
  console.log(`✓ token account: ${SURPLUS} lamports reclaimed, floor ${floor} kept, tokens intact`);
  console.log(`  tx ${signature}`);
}

// --- 2. mint -----------------------------------------------------------------
{
  await overfund(mint);
  const floor = await floorFor(82);
  assert.equal(await lamportsOf(mint), floor + SURPLUS, 'mint is over-funded');

  const signature = await reclaim(mint);
  await connection.confirmTransaction(
    { signature, ...(await connection.getLatestBlockhash()) },
    'confirmed',
  );
  assert.equal(await lamportsOf(mint), floor, 'mint left at its floor');
  console.log(`✓ mint: ${SURPLUS} lamports reclaimed, floor ${floor} kept`);
}

// --- 3. wrapped SOL must be excluded by the scanner --------------------------
{
  const wsol = await getAssociatedTokenAddress(NATIVE_MINT, payer.publicKey);
  await createAssociatedTokenAccount(connection, payer, NATIVE_MINT, payer.publicKey);
  const wrap = new Transaction()
    .add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: wsol,
        lamports: LAMPORTS_PER_SOL / 2,
      }),
    )
    .add(createSyncNativeInstruction(wsol));
  await connection.sendTransaction(wrap, [payer]);
  await new Promise((r) => setTimeout(r, 1000));

  const before = await lamportsOf(wsol);
  let rejected = false;
  try {
    await reclaim(wsol);
  } catch (err) {
    rejected = true;
    console.log(`✓ wrapped SOL rejected on-chain: ${String(err.message).split('\n')[0]}`);
  }
  assert.ok(rejected, 'native accounts must fail — the scanner has to filter them out');
  assert.equal(await lamportsOf(wsol), before, 'wrapped SOL balance untouched');
}

console.log('\nAll end-to-end reclaims passed against the deployed mainnet binary.');
