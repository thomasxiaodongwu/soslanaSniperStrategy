import {
  BlockhashWithExpiryBlockHeight,
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import axios from "axios";
import bs58 from "bs58";
import { Currency, CurrencyAmount } from "@raydium-io/raydium-sdk";
import { connection } from "../helpers/config";

const endpoints = [
  // TODO: Choose a jito endpoint which is closest to your location, and uncomment others
  "http://127.0.0.1:8899",
];

/**
 * Executes and confirms a Jito transaction.
 * @param {Transaction} transaction - The transaction to be executed and confirmed.
 * @param {Account} payer - The payer account for the transaction.
 * @param {Blockhash} lastestBlockhash - The latest blockhash.
 * @param {number} jitofee - The fee for the Jito transaction.
 * @returns {Promise<{ confirmed: boolean, signature: string | null }>} - A promise that resolves to an object containing the confirmation status and the transaction signature.
 */
export async function jito_executeAndConfirm(
  transaction: any,
  payer: Keypair,
  lastestBlockhash: any,
  jitofee: any
) {
  console.log("Executing transaction (jito)...");
  const jito_validator_wallet = new PublicKey("YFzLrQ9HYdL5C9wvHMAbyt7Xx6me12vXWWyTwYmyZaM");
  console.log("Selected Jito Validator: ", jito_validator_wallet.toBase58());
  try {
    const fee = new CurrencyAmount(Currency.SOL, jitofee, false).raw.toNumber();
    console.log(`Jito Fee: ${fee / 10 ** 9} sol, ${fee}`);
    const jitoFee_message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: lastestBlockhash.blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: jito_validator_wallet,
          lamports: fee * 2,
        }),
      ],
    }).compileToV0Message();
    const jitoFee_transaction = new VersionedTransaction(jitoFee_message);
    jitoFee_transaction.sign([payer]);
    const jitoTxSignature = bs58.encode(jitoFee_transaction.signatures[0]);
    const serializedJitoFeeTransaction = bs58.encode(
      jitoFee_transaction.serialize()
    );
    const serializedTransaction = bs58.encode(transaction.serialize());
    const final_transaction = [
      serializedJitoFeeTransaction,
      serializedTransaction,
    ];
    const requests = endpoints.map((url) =>
      axios.post(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: [final_transaction],
      })
    );
    console.log("Sending tx to Jito validators...");
    const res = await Promise.all(requests.map((p) => p.catch((e) => e)));
    console.log(res);
    const success_res = res.filter((r) => !(r instanceof Error));
    if (success_res.length > 0) {
      console.log("Jito validator accepted the tx");
      return await jito_confirm(jitoTxSignature, lastestBlockhash);
    } else {
      console.log("No Jito validators accepted the tx");
      return { confirmed: false, signature: jitoTxSignature };
    }
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      console.log("Failed to execute the jito transaction");
    } else {
      console.log("Error during jito transaction execution: ", e);
    }
    return { confirmed: false, signature: null };
  }
}

/**
 * Confirms a transaction on the Solana blockchain.
 * @param {string} signature - The signature of the transaction.
 * @param {object} latestBlockhash - The latest blockhash information.
 * @returns {object} - An object containing the confirmation status and the transaction signature.
 */
export async function jito_confirm(signature: any, latestBlockhash: any) {
  console.log("Confirming the jito transaction...");
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    },
    "confirmed"
  );
  return { confirmed: !confirmation.value.err, signature };
}

