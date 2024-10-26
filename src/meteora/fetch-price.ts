import { fetchDLMMPoolId, fetchDLMMPool } from "./Pool";
import {usdc} from "./constants";
import bs58 from "bs58";
import { Keypair } from '@solana/web3.js';
import { web3 } from '@project-serum/anchor';

// on-chain rpc method to get the current price of the token
export async function getCurrentPriceInSOL(tokenAddress:string):Promise<any> {
  const dlmmPool = await fetchDLMMPool(tokenAddress);
  dlmmPool.refetchStates();
  const activeBin = await dlmmPool.getActiveBin();
  const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
    Number(activeBin.price)
  );
  return activeBinPricePerToken;
}
export async function getCurrentSolPrice():Promise<any> {

  const dlmmPool = await fetchDLMMPool(usdc);
  dlmmPool.refetchStates();
  const activeBin = await dlmmPool.getActiveBin();
  const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
    Number(activeBin.price)
  );
  return activeBinPricePerToken;
}
export async function getCurrentPriceInUSD(tokenAddress:string):Promise<any> {
    return (await getCurrentPriceInSOL(tokenAddress))*(await getCurrentSolPrice());
}


async function main(){
    // console.log(await getCurrentPriceInSOL("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"));
    // console.log(await getCurrentPriceInUSD("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"));
    // console.log(await getCurrentPriceInUSD("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"));
    const array = Uint8Array.from([207,242,246,234,99,152,62,86,91,168,236,162,127,232,156,5,170,142,176,154,207,15,71,105,70,116,204,135,73,250,189,76,153,208,89,194,96,239,223,33,105,2,183,27,10,24,101,60,169,236,196,202,253,70,197,138,78,4,214,133,110,138,236,148]);
    const address = bs58.encode(array);
    const publicKey = web3.Keypair.fromSecretKey(array).publicKey.toBase58();
    console.log(address);
    console.log(publicKey);
}

main();
