import "rpc-websockets/dist/lib/client";
import {PublicKey, TransactionMessage, VersionedTransaction,} from "@solana/web3.js";
import {connection, jito_fee, wallet} from "../../helpers/config";
import {getSPLTokenBalance} from "../../helpers/check_balance";
import {wsol} from "../constants";
import {fetchDLMMPool} from "./fetch-pool";
import {jito_executeAndConfirm} from "../../transactions/jito_tips_tx_executor";

const {BN} = require('bn.js');

/**
 * Performs a swap operation in a DLMM pool.
 * @param side The side of the swap operation, either "buy" or "sell". Default is "buy".
 * @param tokenAddress The address of the token to be swapped.
 * @param buyAmountInSOL The amount of SOL to be used for buying the token. Default is 0.1.
 * @param sellPercentage The percentage of the token to be sold. Default is 100%.
 * @returns A Promise that resolves to the transaction hash if the swap is successful, otherwise an error object.
 */
export async function swap(
  side: string = "buy",
  tokenAddress: string,
  buyAmountInSOL: number = 0.1,
  sellPercentage: number = 100
) {
  let numberTemp : number;
  let swapYtoX = true,
    decimalY: number,
    decimalX: number,
    inToken: PublicKey,
    outToken: PublicKey,
    swapAmount: any;
  const dlmmPool = await fetchDLMMPool(tokenAddress); // fetch the DLMM pool object for swapping
  decimalY = dlmmPool.tokenY.decimal;
  decimalX = dlmmPool.tokenX.decimal;
  console.log('---DLMM POOL---');
  console.log(dlmmPool);
  if (side === "buy") {
    // inToken = wsol
    if (dlmmPool.tokenY.publicKey.toBase58() === wsol) {
      inToken = dlmmPool.tokenY.publicKey;
      outToken = dlmmPool.tokenX.publicKey;
    } else {
      inToken = dlmmPool.tokenX.publicKey;
      outToken = dlmmPool.tokenY.publicKey;
    }
    numberTemp = buyAmountInSOL * 10 ** 9;
    swapAmount = new BN(numberTemp); // convert to lamports
  } else {
    if (dlmmPool.tokenY.publicKey.toBase58() === wsol) {
      inToken = dlmmPool.tokenX.publicKey;
      outToken = dlmmPool.tokenY.publicKey;
      const balance = await getSPLTokenBalance(
        connection,
        inToken,
        wallet.publicKey
      );
      const amount = balance * (sellPercentage / 100);
      swapAmount = new BN(amount * 10 ** decimalX); // convert to lamports
    } else {
      inToken = dlmmPool.tokenY.publicKey;
      outToken = dlmmPool.tokenX.publicKey;
      const balance = await getSPLTokenBalance(
        connection,
        inToken,
        wallet.publicKey
      );
      const amount = balance * (sellPercentage / 100);
      swapAmount = new BN(amount * 10 ** decimalY); // convert to lamports
    }
  }

  const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX); // list of pools
  console.log('---BinArrayAccount---');
  console.log(binArrays);
  const swapQuote = await dlmmPool.swapQuote(
    // get the swap quote
    swapAmount,
    swapYtoX,
    new BN(10),
    binArrays
  );
  console.log('---swapQuote---');
  console.log(swapQuote);
  const swapTx: any = await dlmmPool.swap({
    inToken: inToken,
    binArraysPubkey: swapQuote.binArraysPubkey,
    inAmount: swapAmount,
    lbPair: dlmmPool.pubkey,
    user: wallet.publicKey,
    minOutAmount: swapQuote.minOutAmount,
    outToken: outToken,
  });
  console.log('---swapTx---');
  console.log(swapTx);
  // try {
  //   const swapTxHash = await sendAndConfirmTransaction(connection, swapTx, [
  //     wallet,
  //   ]);
  //   console.log(`🚀 https://solscan.io/tx/${swapTxHash}`);
  // } catch (error) {
  //   console.log("🚀 ~ error:", JSON.parse(JSON.stringify(error)));
  // }
  try {
    const recentBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: recentBlockhash.blockhash,
      instructions: [...swapTx.instructions],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet]);
    console.log('---transaction---');
    console.log(transaction);
    /*const res = await jito_executeAndConfirm(
      transaction,
      wallet,
      recentBlockhash,
      jito_fee
    );
    const signature = res.signature;
    const confirmed = res.confirmed;

    if (confirmed) {
      console.log(`🚀 https://solscan.io/tx/${signature}`);
    } else {
      console.log(
        "jito fee transaction failed when swapping token in a DLMM pool"
      );
    }*/
  } catch (error: any) {
    console.log("🚀 ~ error:", JSON.parse(JSON.stringify(error)));
  }
}
async function main() {
  const tokenAddress = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";
  await swap("buy", tokenAddress, 0.01, -1);
  //await swap("sell", tokenAddress, -1, 100);
}
main();
