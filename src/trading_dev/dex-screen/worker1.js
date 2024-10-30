import { parentPort } from 'worker_threads';
import {setTimeout} from "timers/promises";
import {clearInterval} from "timers";
import cache from "./cache.js";
import JSBI from 'jsbi';
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

function getRandomAmt(runtime) {
    const min = Math.ceil((runtime*10000)*0.99);
    const max = Math.floor((runtime*10000)*1.01);
    return ((Math.floor(Math.random() * (max - min + 1)) + min)/10000);
}

const toDecimal = (number, decimals) => parseFloat(String(number) / 10 ** decimals).toFixed(decimals);
const storeItInTempAsJSON = (filename, data) => fs.writeFileSync(`./temp/${filename}.json`, JSON.stringify(data, getCircularReplacer(), 2));
const calculateProfit = ((oldVal, newVal) => ((newVal - oldVal) / oldVal) * 100);
const checkRoutesResponse = (routes) => {
    if (Object.hasOwn(routes, "routesInfos")) {
        if (routes.routesInfos.length === 0) {
            console.log(routes);
            logExit(1, {
                message: "No routes found or something is wrong with RPC / Jupiter! ",
            });
            process.exit(1);
        }
    } else {
        console.log(routes);
        logExit(1, {
            message: "Something is wrong with RPC / Jupiter! ",
        });
        process.exit(1);
    }
};


const swap = async (jupiter, route) => {
    try {
        const performanceOfTxStart = performance.now();
        cache.performanceOfTxStart = performanceOfTxStart;

        if (process.env.DEBUG) storeItInTempAsJSON("routeInfoBeforeSwap", route);

        // pull the trade priority
        const priority = typeof cache.config.priority === "number" ? cache.config.priority : 100; //100 BPS default if not set
        cache.priority = priority;

        const { execute } = await jupiter.exchange({
            routeInfo: route,
            computeUnitPriceMicroLamports: priority,
        });
        const result = await execute();

        if (process.env.DEBUG) storeItInTempAsJSON("result", result);

        // Reset counter on success
        cache.tradeCounter.failedbalancecheck = 0;
        cache.tradeCounter.errorcount = 0;

        const performanceOfTx = performance.now() - performanceOfTxStart;

        return [result, performanceOfTx];
    } catch (error) {
        console.log("Swap error: ", error);
    }
};

const pingpongStrategy = async (jupiter, tokenA, tokenB) => {
    const date = new Date();
    const tempI = 1;
    try {
        // Calculate amount that will be used for trade
        const amountToTrade = 0.5;

        const baseAmount = cache.lastBalance[cache.sideBuy ? "tokenB" : "tokenA"];
        const slippage = 1; // 1BPS is 0.01%

        // set input / output token
        const inputToken = cache.sideBuy ? tokenA : tokenB;
        const outputToken = cache.sideBuy ? tokenB : tokenA;
        const amountInJSBI = JSBI.BigInt(amountToTrade);

        // check current routes via JUP4 SDK
        const performanceOfRouteCompStart = performance.now();
        const routes = await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            amount: amountInJSBI,
            slippageBps: slippage,
            forceFetch: true,
            onlyDirectRoutes: false,
            filterTopNResult: 5,
        });

        checkRoutesResponse(routes);
        const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;
        // choose first route
        const route = await routes.routesInfos[0];
        // calculate profitability
        const simulatedProfit = calculateProfit(String(baseAmount), await JSBI.toNumber(route.outAmount));

        // Alter slippage to be larger based on the profit if enabled in the config
        // set cache.config.adaptiveSlippage=1 to enable
        // Profit minus minimum profit
        // default to the set slippage
        var slippagerevised = slippage;

        if ((simulatedProfit > cache.config.minPercProfit) && cache.config.adaptiveSlippage == 1){
            var slippagerevised = (100*(simulatedProfit-cache.config.minPercProfit+(slippage/100))).toFixed(3)

            if (slippagerevised>500) {
                // Make sure on really big numbers it is only 30% of the total
                slippagerevised = (0.3*slippagerevised).toFixed(3);
            } else {
                slippagerevised = (0.8*slippagerevised).toFixed(3);
            }

            //console.log("Setting slippage to "+slippagerevised);
            route.slippageBps = slippagerevised;
        }

        // store max profit spotted
        if (
            simulatedProfit > cache.maxProfitSpotted[cache.sideBuy ? "buy" : "sell"]
        ) {
            cache.maxProfitSpotted[cache.sideBuy ? "buy" : "sell"] = simulatedProfit;
        }

        console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);

        // check profitability and execute tx
        let tx, performanceOfTx;
        if (!cache.swappingRightNow) {
            route.otherAmountThreshold = 0;

            if (cache.tradingEnabled) {
                cache.swappingRightNow = true;
                // store trade to the history
                let tradeEntry = {
                    date: date.toLocaleString(),
                    buy: cache.sideBuy,
                    inputToken: inputToken.symbol,
                    outputToken: outputToken.symbol,
                    inAmount: toDecimal(route.amount, inputToken.decimals),
                    expectedOutAmount: toDecimal(route.outAmount, outputToken.decimals),
                    expectedProfit: simulatedProfit,
                    slippage: slippagerevised,
                };

                // start refreshing status
                const printTxStatus = setInterval(() => {
                    console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);
                }, 250);

                [tx, performanceOfTx] = await swap(jupiter, route);

                // stop refreshing status
                clearTimeout(printTxStatus);

                const profit = calculateProfit(
                    cache.currentBalance[cache.sideBuy ? "tokenB" : "tokenA"],
                    tx.outputAmount
                );

                tradeEntry = {
                    ...tradeEntry,
                    outAmount: tx.outputAmount || 0,
                    profit,
                    performanceOfTx,
                    error: tx.error?.code === 6001 ? "Slippage Tolerance Exceeded" : tx.error?.message || null,
                };

                await new Promise((resolve) => setTimeout(resolve, 250));

                // handle TX results
                if (tx.error) {
                    //await failedSwapHandler(tradeEntry, inputToken, amountToTrade);
                }
                else {
                    //await successSwapHandler(tx, tradeEntry, tokenA, tokenB);
                }
            }
        }

        if (tx) {
            if (!tx.error) {
                // change side
                cache.sideBuy = !cache.sideBuy;
            }
            cache.swappingRightNow = false;
        }

        console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);

    } catch (error) {
        console.log(error);
    } finally {

    }
};

const arbitrageStrategy = async (jupiter, tokenA) => {
    const date = new Date();
    const i = 1;
    swapactionrun: try {
        // Calculate amount that will be used for trade
        const amountToTrade = 0.5;
        const baseAmount = amountToTrade;

        //BNI AMT to TRADE
        const amountInJSBI = JSBI.BigInt(amountToTrade);
        //console.log('Amount to trade:'+amountToTrade);

        // default slippage
        const slippage = typeof cache.config.slippage === "number" ? cache.config.slippage : 1; // 100 is 0.1%

        // set input / output token
        const inputToken = tokenA;
        const outputToken = tokenA;

        // check current routes
        const performanceOfRouteCompStart = performance.now();
        const routes = await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            amount: amountInJSBI,
            slippageBps: slippage,
            feeBps: 0,
            forceFetch: true,
            onlyDirectRoutes: false,
            filterTopNResult: 2,
            enforceSingleTx: false,
            swapMode: 'ExactIn',
        });

        //console.log('Routes Lookup Run for '+ inputToken.address);
        checkRoutesResponse(routes);

        // count available routes
        cache.availableRoutes[cache.sideBuy ? "buy" : "sell"] =
            routes.routesInfos.length;

        const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;

        // choose first route
        const route = await routes.routesInfos[0];

        // calculate profitability
        const simulatedProfit = calculateProfit(baseAmount, await JSBI.toNumber(route.outAmount));
        const minPercProfitRnd = getRandomAmt(1);
        //console.log('mpp:'+minPercProfitRnd);

        var slippagerevised = slippage;

        if (simulatedProfit > 1){
            slippagerevised = (100*(simulatedProfit-minPercProfitRnd+(slippage/100))).toFixed(3)

            // Set adaptive slippage
            if (slippagerevised>500) {
                // Make sure on really big numbers it is only 30% of the total if > 50%
                slippagerevised = (0.30*slippagerevised).toFixed(3);
            } else {
                slippagerevised = (0.80*slippagerevised).toFixed(3);
            }
            //console.log("Setting slippage to "+slippagerevised);
            route.slippageBps = slippagerevised;
        }

        // store max profit spotted
        if (simulatedProfit > cache.maxProfitSpotted["buy"]) {
            cache.maxProfitSpotted["buy"] = simulatedProfit;
        }

        console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);

        // check profitability and execute tx
        let tx, performanceOfTx;
        if (!cache.swappingRightNow) {
            if (cache.tradingEnabled) {
                cache.swappingRightNow = true;
                // store trade to the history
                console.log('swappingRightNow');
                let tradeEntry = {
                    date: date.toLocaleString(),
                    buy: cache.sideBuy,
                    inputToken: inputToken.symbol,
                    outputToken: outputToken.symbol,
                    inAmount: toDecimal(route.amount, inputToken.decimals),
                    expectedOutAmount: toDecimal(route.outAmount, outputToken.decimals),
                    expectedProfit: simulatedProfit,
                };

                // start refreshing status
                const printTxStatus = setInterval(() => {
                    if (cache.swappingRightNow) {
                        console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);
                    }
                }, 250);

                [tx, performanceOfTx] = await swap(jupiter, route);

                // stop refreshing status
                clearInterval(printTxStatus);

                // Calculate the profit of the trade
                const profit = calculateProfit(tradeEntry.inAmount, tx.outputAmount);

                tradeEntry = {
                    ...tradeEntry,
                    outAmount: tx.outputAmount || 0,
                    profit,
                    performanceOfTx,
                    error: tx.error?.code === 6001 ? "Slippage Tolerance Exceeded" : tx.error?.message || null,
                    slippage: slippagerevised,
                };

                // handle TX results
                if (tx.error) {
                    // Slippage tolerance exceeded
                    //await failedSwapHandler(tradeEntry, inputToken, amountToTrade);
                } else {
                    //await successSwapHandler(tx, tradeEntry, tokenA, tokenA);
                }
            }
        }

        if (tx) {
            cache.swappingRightNow = false;
        }

        console.log('-'+date+'-'+tempI+'-'+performanceOfRouteComp+'-'+inputToken+'-'+outputToken+'-'+tokenA+'-'+tokenB+'-'+route+'-'+simulatedProfit);
    } catch (error) {
        throw error;
    } finally {
    }
};

const computeStrategy = async (jupiter, tokenA) => {
    swapactionrun: try {
        // Calculate amount that will be used for trade
        const amountToTrade = 0.5;
        const baseAmount = amountToTrade;

        //BNI AMT to TRADE
        const amountInJSBI = JSBI.BigInt(amountToTrade);
        //console.log('Amount to trade:'+amountToTrade);

        // default slippage
        const slippage = 1; // 100 is 0.1%

        // set input / output token
        const inputToken = tokenA;
        const outputToken = tokenA;

        // check current routes
        const performanceOfRouteCompStart = performance.now();
        const routes = await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            amount: amountInJSBI,
            slippageBps: slippage,
            feeBps: 0,
            forceFetch: true,
            onlyDirectRoutes: false,
            filterTopNResult: 2,
            enforceSingleTx: false,
            swapMode: 'ExactIn',
        });

        //console.log('Routes Lookup Run for '+ inputToken.address);
        checkRoutesResponse(routes);

        // count available routes
        cache.availableRoutes[cache.sideBuy ? "buy" : "sell"] = routes.routesInfos.length;

        const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;
        console.log('performanceOfRouteComp:'+performanceOfRouteComp);
        // choose first route
        const route = await routes.routesInfos[0];
        // calculate profitability
        const simulatedProfit = calculateProfit(baseAmount, await JSBI.toNumber(route.outAmount));
        console.log('simulatedProfit:'+simulatedProfit);

    } catch (error) {
        throw error;
    } finally {
    }
};