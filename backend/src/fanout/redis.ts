import IORedis from 'ioredis';

// Plain options passed to BullMQ (it uses its own internal ioredis)
export const connectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

// Separate ioredis client for direct Redis commands in aggregator
export const redisClient = new IORedis({
  ...connectionOptions,
  maxRetriesPerRequest: null,
});
