import { Queue } from 'bullmq';
import { connectionOptions as connection } from './redis';
import { FanoutJobPayload } from './types';

export const fanoutQueue = new Queue<FanoutJobPayload>('yf-fanout', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 }, // retry with backoff on failure (e.g. Yahoo 429)
    removeOnComplete: false, // keep completed jobs so results can be read
    removeOnFail: false,
  },
});
