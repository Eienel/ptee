/**
 * Dumps the deployed SPL Token program binary into tests/fixtures/token.so so
 * the end-to-end test runs against the exact code that runs on mainnet, rather
 * than whatever build a local validator happens to bundle.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const UPGRADEABLE_HEADER = 45;

const connection = new Connection(RPC, 'confirmed');
const program = await connection.getAccountInfo(TOKEN);
if (!program) throw new Error(`Token program not found on ${RPC}`);

const programData = new PublicKey(program.data.subarray(4, 36));
const info = await connection.getAccountInfo(programData);
if (!info) throw new Error(`Program data account ${programData.toBase58()} not found`);

const elf = info.data.subarray(UPGRADEABLE_HEADER);
if (elf.subarray(0, 4).toString('hex') !== '7f454c46') throw new Error('Not an ELF binary');

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/token.so', elf);
console.log(`Wrote tests/fixtures/token.so (${elf.length} bytes) from ${RPC}`);
