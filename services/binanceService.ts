import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Binance = require('node-binance-api');

export function createClient(apiKey: string, secretKey: string) {
  return new Binance().options({
    APIKEY: apiKey,
    APISECRET: secretKey,
    useServerTime: true
  });
}

export async function placeOrder({ apiKey, secretKey, symbol, side, quantity }: any) {
  const client = createClient(apiKey, secretKey);
  try {
    let result;
    if (side === 'BUY') {
      result = await client.marketBuy(symbol, quantity);
    } else {
      result = await client.marketSell(symbol, quantity);
    }
    return result;
  } catch (err: any) {
    throw err;
  }
}

export async function getAccountInfo({ apiKey, secretKey }: any) {
  const client = createClient(apiKey, secretKey);
  return new Promise((resolve, reject) => {
    client.balance((error: any, balances: any) => {
      if (error) reject(error);
      else resolve(balances);
    });
  });
}
