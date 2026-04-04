import fetch from 'node-fetch';
import { ConvexClient } from 'convex/browser';

let convexClient = null;

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name} for Convex bot runtime.`);
  }
  return value;
}

export function getConvexConfig() {
  return {
    convexUrl: requireEnv('CONVEX_URL'),
    convexSiteUrl: requireEnv('CONVEX_SITE_URL').replace(/\/$/, ''),
    botSecret: requireEnv('CONVEX_BOT_SHARED_SECRET'),
  };
}

function getConvexClient() {
  if (!convexClient) {
    convexClient = new ConvexClient(getConvexConfig().convexUrl);
  }

  return convexClient;
}

export function getBotSecret() {
  return getConvexConfig().botSecret;
}

export function subscribeBotQuery(queryRef, args, onValue, onError) {
  return getConvexClient().onUpdate(queryRef, args, onValue, onError);
}

export async function postConvexBotAction(path, body = {}) {
  const { convexSiteUrl, botSecret } = getConvexConfig();
  const response = await fetch(`${convexSiteUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-convex-bot-secret': botSecret,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Convex HTTP action ${path} returned a non-JSON response.`);
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Convex HTTP action ${path} failed with ${response.status}.`);
  }

  return payload;
}
