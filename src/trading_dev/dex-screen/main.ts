import { logger } from "../../helpers/logger";
import axios from "axios";
import { Worker } from 'worker_threads';

const worker = new Worker('./worker.ts');
worker.on('message', (msg) => {
    console.log('来自工作线程的消息:', msg);
});

const PING_INTERVAL_MS = 1_001;
async function snipe() {

    setInterval(async () => {
        axios.get("https://api.dexscreener.com/token-profiles/latest/v1", {})
            .then(response => {
                const resJson = JSON.parse(response.data);
                if(resJson.chainId === "solana"){
                    worker.postMessage({ computePrimesUpTo: resJson.tokenAddress });
                }
            })
            .catch(error => {
                logger.info(error);
            });
    }, PING_INTERVAL_MS);
}

snipe();
