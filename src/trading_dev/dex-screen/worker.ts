import { parentPort } from 'worker_threads';
import { logger } from "../../helpers/logger";
import {setTimeout} from "timers/promises";
const cache = require("./cache");
const JSBI = require('jsbi');
const { printToConsole } = require("./ui/printToConsole.js");
const {
    calculateProfit,
    toDecimal,
    toNumber,
    updateIterationsPerMin,
    checkRoutesResponse,
    checkArbReady,
} = require("./utils/index.js");
const { PublicKey } = require("@solana/web3.js");
const { swap, failedSwapHandler, successSwapHandler } = require("./swap.js");
