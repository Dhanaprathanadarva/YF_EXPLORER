import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter }   from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter }  from '@bull-board/express';
import { fanoutQueue }     from './queue';

export function createBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues:        [new BullMQAdapter(fanoutQueue)],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
