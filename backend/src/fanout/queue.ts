import { Queue } from 'bullmq';
import { connectionOptions as connection } from './redis';
import { FanoutJobPayload } from './types';

export const fanoutQueue = new Queue<FanoutJobPayload>('yf-fanout', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 }, 
    removeOnComplete: false,
    removeOnFail: false,
  },
});
