import { parentPort } from 'worker_threads';
import { logger } from "../../helpers/logger";

if (parentPort === null) {
    throw new Error('Cannot get parent port');
}

parentPort.on('message', (msg) => {
    const coin = msg.computePrimesUpTo;
    logger.info(` Accept bew coin: ${coin}`);
});