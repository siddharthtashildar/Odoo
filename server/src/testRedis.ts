import { redis } from "./lib/redis";

async function test() {
    await redis.set("hello", "world");

    const value = await redis.get("hello");

    console.log(value);
}

test();