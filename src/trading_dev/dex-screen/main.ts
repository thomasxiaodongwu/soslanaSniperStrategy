import { logger } from "../../helpers/logger";
import axios from "axios";
import { Worker } from 'worker_threads';
import path from 'path';

const worker = new Worker(path.resolve(__dirname, './worker.ts'));

worker.on('error', (error) => {
    console.error(`Worker error: ${error}`);
});

worker.on('exit', (code) => {
    if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
    } else {
        console.log('Worker exited successfully');
    }
});

const PING_INTERVAL_MS = 1_001;


setInterval(async () => {
    axios.get("https://api.dexscreener.com/token-profiles/latest/v1", {})
        .then(response => {
            console.log(response.data);
            const resJson = JSON.parse(response.data);
            if(resJson.chainId === "solana"){
                worker.postMessage({ computePrimesUpTo: resJson.tokenAddress });
            }
        })
        .catch(error => {
            logger.info(error);
        });
}, PING_INTERVAL_MS);


