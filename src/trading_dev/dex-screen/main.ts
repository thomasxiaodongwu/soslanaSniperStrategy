import { logger } from "../../helpers/logger";
import { getCurrentPriceInSOL } from "../../jupiter/fetch-price";
import axios from "axios";
import { Worker } from 'worker_threads';
import path from 'path';
const { Jupiter, SwapMode, TOKEN_LIST_URL } = require("@jup-ag/core");
const { Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
import {Cluster, PublicKey} from "@solana/web3.js";
import JSBI from "jsbi";
const bs58 = require("bs58");
const PING_INTERVAL_MS = 1_001;
interface ApiResponse {
    tokenAddress: string;
    chainId: string;
}

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=98347d3d-111e-437f-97b2-0d0acc953b2d");
const wallet = Keypair.fromSecretKey(bs58.decode("4H78gTnvDdW9ZumPra6mB4kYsArUcJF3W7hAedt42BYLBHXtWp1uGbcKF6KLSBFxsHVsyLfuW4qjn8ZTkfXadAcJ")); // private key
const ENV: Cluster = "mainnet-beta";
const INPUT_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const OUTPUT_MINT_ADDRESS = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // USDT
interface Token {
    chainId: number; // 101,
    address: string; // '8f9s1sUmzUbVZMoMh6bufMueYH1u4BJSM57RCEvuVmFp',
    symbol: string; // 'TRUE',
    name: string; // 'TrueSight',
    decimals: number; // 9,
    logoURI: string; // 'https://i.ibb.co/pKTWrwP/true.jpg',
    tags: string[]; // [ 'utility-token', 'capital-token' ]
}
const main = async () => {
    const jupiter = await Jupiter.load({
        connection,
        cluster: ENV,
        user: wallet,
        restrictIntermediateTokens: false,
        shouldLoadSerumOpenOrders: false,
        wrapUnwrapSOL: true,
        ammsToExclude: {
            'Aldrin': false,
            'Crema': false,
            'Cropper': true,
            'Cykura': true,
            'DeltaFi': false,
            'GooseFX': true,
            'Invariant': false,
            'Lifinity': false,
            'Lifinity V2': false,
            'Marinade': false,
            'Mercurial': false,
            'Meteora': false,
            'Raydium': false,
            'Raydium CLMM': false,
            'Saber': false,
            'Serum': true,
            'Orca': false,
            'Step': false,
            'Penguin': false,
            'Saros': false,
            'Stepn': true,
            'Orca (Whirlpools)': false,
            'Sencha': false,
            'Saber (Decimals)': false,
            'Dradex': true,
            'Balansol': true,
            'Openbook': false,
            'Marco Polo': false,
            'Oasis': false,
            'BonkSwap': false,
            'Phoenix': false,
            'Symmetry': true,
            'Unknown': true
        }
    });

    try {
        // Calculate amount that will be used for trade
        const amountToTrade = 0.5;
        const baseAmount = amountToTrade;

        //BNI AMT to TRADE
        const amountInJSBI = JSBI.BigInt(amountToTrade);
        //console.log('Amount to trade:'+amountToTrade);

        // default slippage
        const slippage = 1; // 100 is 0.1%
        const inputMint = '5pQSTDfeUppb6tV415RWygL8n3ctyakBTV7QzBn5pump';
        // check current routes
        const performanceOfRouteCompStart = performance.now();
        const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[ENV])).json();
        const routeMap = jupiter.getRouteMap();

        // If you know which input/output pair you want
        const inputToken= tokens.find((t) => t.address == INPUT_MINT_ADDRESS); // USDC Mint Info
        const outputToken = tokens.find((t) => t.address == OUTPUT_MINT_ADDRESS); // USDT Mint Info

        if (inputToken && "address" in inputToken) {
            if (outputToken && "address" in outputToken) {
                const routes = await jupiter.computeRoutes({
                    inputMint: new PublicKey(inputToken.address),
                    outputMint: new PublicKey(outputToken.address),
                    amount: amountInJSBI,
                    slippageBps: slippage,
                    feeBps: 0,
                    forceFetch: true,
                    onlyDirectRoutes: false,
                    swapMode: SwapMode.ExactIn,
                    filterTopNResult: 2,
                });

                const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;
                console.log('performanceOfRouteComp:'+performanceOfRouteComp);
                // choose first route
                const route = await routes.routesInfos[0];
                // calculate profitability
                const simulatedProfit = await calculateProfit(baseAmount, await JSBI.toNumber(route.outAmount));
                console.log('simulatedProfit:'+simulatedProfit);
            }
        }
    } catch (error) {
        throw error;
    } finally {
    }

    // setInterval(async () => {
    //     console.log("start");
    //     axios.get("https://api.dexscreener.com/token-profiles/latest/v1", {})
    //         .then(async response => {
    //             const data: ApiResponse[] = response.data;
    //             for (const item of data) {
    //                 if (item.chainId === "solana") {
    //                     if (await getCurrentPriceInSOL(item.tokenAddress)) {
    //                         worker.postMessage({computePrimesUpTo: item.tokenAddress, jupiter: jupiter});
    //                     }
    //                 }
    //             }
    //         })
    //         .catch(error => {
    //             logger.info(error);
    //         });
    // }, PING_INTERVAL_MS);
}

async function calculateProfit(newVal:number, oldVal:number) {
    return ((newVal - oldVal) / oldVal) * 100;
}

main();



