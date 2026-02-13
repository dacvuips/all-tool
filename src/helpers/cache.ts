import redis, { PrefixKey } from "./redis";
/**
 * Set cache value
 *
 * @param {*} key
 * @param {*} value
 * @param {*} ttl seconds
 */
const set = async (key: string, value: any, ttl?: number) => {
  //  const lock = await redlock.lock(`redlock:${key}`, 500);

  let result;
  if (ttl) {
    result = await redis.setex(key, ttl, value);
  } else {
    result = await redis.set(key, value);
  }

  //  await lock.unlock();
  return result;
};

const setnx = async (key: string, value: string, ttl?: number) => {
  const result = await redis.setnx(key, value);
  if (result === 1 && ttl) {
    // console.log("set expire for key: ", key, " with ttl: ", ttl, " seconds");
    await redis.expire(key, ttl);
  }
  return result;
};

/**
 * Get value from key
 *
 * return true;
 * @param {*} key
 */
const get = async (key: string) => {
  //  const lock = await redlock.lock(`redlock:${key}`, 500);
  return new Promise<string>((resolve, reject) => {
    redis.get(key, async (err, result) => {
      //  await lock.unlock();
      if (err) reject(err);
      resolve(result);
    });
  });
};

/**
 *
 * Get value with TTL
 *
 * @param {*} key
 * @returns
 */
const getWithTTL = async (key: string) => {
  return new Promise<any[]>((resolve, reject) => {
    redis
      .multi()
      .ttl(key)
      .get(key)
      .exec((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
  });
};

/**
 * Delete key
 *
 * @param {*} key
 */
const del = async (key: string) => {
  //  const lock = await redlock.lock(`redlock:${key}`, 500);
  const result = await redis.del(key);
  //  await lock.unlock();
  return result;
};

/** Delete key by pattern */
const delByPattern = async (pattern: string) => {
  return new Promise<number>((resolve, reject) =>
    redis.keys(PrefixKey + pattern, (err, keys) => {
      if (err) return reject(err);
      if (keys.length === 0) return resolve(0);
      // replace prefix key
      keys = keys.map((key) => key.replace(PrefixKey, ""));
      return redis.del(keys, (err, reply) => {
        if (err) return reject(err);
        return resolve(reply);
      });
    })
  );
};

/**
 * Set cache value
 *
 * @param {*} key
 * @param {*} field
 * @param {*} value
 */
const hset = async (key: string, field: string, value: string) => {
  //  const lock = await redlock.lock(`redlock:${key}:${field}`, 500);
  const result = await redis.hset(key, field, value);
  //  await lock.unlock();
  return result;
};

/**
 * HSETNX key field value
 * and set expire time
 */
const hsetnx = async (key: string, field: string, value: string, ttl?: number) => {
  return new Promise<number>((resolve, reject) =>
    redis.hsetnx(key, field, value, async (err, result) => {
      if (err) return reject(err);
      if (result === 1 && ttl) {
        // console.log("set expire for key: ", key, " with ttl: ", ttl, " seconds");
        await redis.expire(key, ttl);
      }
      return resolve(result);
    })
  );
};

/**
 * HSET with TTL
 */
const hsetWithTTL = async (key: string, field: string, value: string, ttl?: number) => {
  const result = await redis.hset(key, field, value);
  if (result === 1 && ttl) {
    // console.log("set expire for key: ", key, " with ttl: ", ttl, " seconds");
    await redis.expire(key, ttl);
  }
  return result;
};

/**
 * HSET ALL
 */
const hmset = async (key: string, value: any) => {
  return new Promise<string>((resolve, reject) =>
    redis.hmset(key, value, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

/**
 * Get value from key
 *
 * @param {*} key
 * @param {*} field
 */
const hget = async (key: string, field: string) => {
  //  const lock = await redlock.lock(`redlock:${key}:${field}`, 500);
  const result = await hgetWithoutLock(key, field);
  //  await lock.unlock();
  return result;
};

/**
 * Get value from key wihtout lock
 * @param {*} key
 * @param {*} field
 * @returns
 */
const hgetWithoutLock = async (key: string, field: string) => {
  return new Promise<string>((resolve, reject) =>
    redis.hget(key, field, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

/**
 * Get value from key
 *
 * @param {*} key
 */
const hgetall = async (key: string) => {
  return new Promise<any>((resolve, reject) => {
    redis.hgetall(key, (err, reply) => {
      if (err) return reject(err);
      resolve(reply);
    });
  });
};

/**
 * Delete key/field
 *
 * @param {*} key
 * @param {*} field
 */
const hdel = async (key: string, field: string) => {
  //  const lock = await redlock.lock(`redlock:${key}:${field}`, 500);
  const result = await redis.hdel(key, field);
  //  await lock.unlock();
  return result;
};

const incr = async (key: string) => {
  return new Promise<number>((resolve, reject) =>
    redis.incr(key, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

/** Incr By Value */
const incrby = async (key: string, value: number) => {
  return new Promise<number>((resolve, reject) =>
    redis.incrby(key, value, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

const hincr = async (key: string, field: string, increment: number = 1) => {
  return new Promise<number>((resolve, reject) =>
    redis.hincrby(key, field, increment, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

const hincrBy = async (key: string, field: string, increment: number = 1) => {
  return new Promise<number>((resolve, reject) =>
    redis.hincrby(key, field, increment, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

const exists = async (key: string) => {
  return new Promise<boolean>((resolve, reject) =>
    redis.exists(key, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply === 1);
    })
  );
};

const expire = async (key: string, ttl: number) => {
  return new Promise<boolean>((resolve, reject) =>
    redis.expire(key, ttl, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply === 1);
    })
  );
};

const evalScript = async (script: string, keys: string[], args: string[]) => {
  return new Promise<any>((resolve, reject) =>
    redis.eval(script, keys.length, ...keys, ...args, (err, reply) => {
      if (err) return reject(err);
      return resolve(reply);
    })
  );
};

export default {
  set,
  setnx,
  get,
  getWithTTL,
  del,
  delByPattern,
  hset,
  hmset,
  hgetWithoutLock,
  hsetWithTTL,
  hget,
  hsetnx,
  hgetall,
  hdel,
  incr,
  incrby,
  hincr,
  hincrBy,
  exists,
  expire,
  evalScript,
};
