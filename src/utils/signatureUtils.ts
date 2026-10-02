import firebaseApp from '../../src/firebaseAdmin';

import { generateNonce, sign } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';
import {
  createSignature,
  ResponseDescriptor,
  SignatureFields,
  webcrypto,
} from 'http-message-sig';
import { getDatabase } from 'firebase-admin/database';

const { subtle } = globalThis.crypto;
const db = getDatabase(firebaseApp);

const signingConfig = {
  signatureAgent:
    process.env.BOT_AUTH_SIGNATURE_AGENT ?? 'ERROR_SIGNATURE_AGENT_UNSET',
  userAgent: process.env.BOT_AUTH_USER_AGENT ?? 'ERROR_BOT_USER_AGENT_UNSET',
};

export type BotSignPublicKey = JsonWebKey & {
  nbf: number; // UNIX timestamp (millis), not before
  exp: number; // UNIX timestamp (millis), expiration
  kid: string; // key id (JWK+SHA256 thumbprint)
};

export type BotSignDirectory = {
  keys: BotSignPublicKey[];
};

export type SignedBotSignDirectory = {
  directory: BotSignDirectory;
  signatureData: SignatureFields[];
};

export type BotSignKeyPair = {
  privKey: JsonWebKey;
  pubKey: JsonWebKey;
  nbf: number; // UNIX timestamp (millis), not before
  exp: number; // UNIX timestamp (millis), expiration
  kid: string; // key id (JWK+SHA256 thumbprint)
};

async function generateKey(): Promise<CryptoKeyPair> {
  return await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
}

/**
 * Generate a new signing keypair.
 * @returns the freshly generated request signing keypair
 */
async function rotateKey() {
  const keysRef = db.ref('bot-signatures/key-directory');
  const keyPair = await generateKey();
  const privKey = await subtle.exportKey('jwk', keyPair.privateKey);
  const pubKey = await subtle.exportKey('jwk', keyPair.publicKey);
  pubKey.alg = privKey.alg = 'EdDSA'; // for some reason this is required by signerFromJWK, even though the standard tag is Ed25519
  const signer = await signerFromJWK(privKey);
  const now = Date.now();
  const key: BotSignKeyPair = {
    privKey,
    pubKey,
    kid: signer.keyid,
    nbf: now - 60 * 1000, // avoid clock desync (not sure if CF is using this field though)
    exp: now + 30 * 24 * 60 * 60 * 1000, // demo signature directory is using millis here
  };
  await keysRef.push(key);
  return key;
}

/**
 * Rotate old keys, remove expired ones.
 * @returns the earliest valid request signing keypair
 */
async function rotateAndGetFreshKeyPair(): Promise<BotSignKeyPair> {
  const now = Date.now();
  let earliestValidKeyPair: BotSignKeyPair | undefined = undefined;
  const keys = await db
    .ref('bot-signatures/key-directory')
    .orderByChild('exp')
    .get();

  const removePromises: Promise<void>[] = [];
  let noNewKeyAvailable = true;
  keys.forEach(child => {
    const keyPair = child.val() as BotSignKeyPair;
    if (!earliestValidKeyPair && keyPair.exp > now) {
      earliestValidKeyPair ??= keyPair;
    }
    if (keyPair.exp > now + 7 * 24 * 60 * 60 * 1000) {
      noNewKeyAvailable = false;
    } else if (keyPair.exp < now - 60 * 1000) {
      removePromises.push(child.ref.remove());
    }
  });
  await Promise.allSettled(removePromises);

  if (noNewKeyAvailable && earliestValidKeyPair) {
    await rotateKey();
  }
  earliestValidKeyPair ??= await rotateKey();

  return earliestValidKeyPair;
}

/**
 * Create the Signature-Input and Signature headers for the key directory. Note that
 * these fields can't be simply dropped into the headers, unless there is only a
 * single one. (Use the {@link sign} function to get the final response headers.)
 *
 * @param now signing time in seconds
 * @param authority signing authority, generally the hostname
 * @param key request signing keypair
 * @param label signature label, must be different for every key
 * @returns signature header fields for the given key
 */
async function signDirectoryEntry(
  now: number,
  authority: string,
  key: BotSignKeyPair,
  label: string
): Promise<SignatureFields> {
  const request: ResponseDescriptor = {
    kind: 'response',
    status: 200,
    fields: [],
    request: {
      kind: 'request',
      method: 'GET',
      targetUri: `https://${authority}/.well-known/http-message-signatures-directory`,
      fields: [],
    },
  };
  const signer = webcrypto.signer(
    await subtle.importKey('jwk', key.privKey, { name: 'Ed25519' }, false, [
      'sign',
    ])
  );
  return await createSignature(request, {
    label,
    signer,
    components: [{ name: '@authority', parameters: { req: true } }],
    parameters: {
      created: now, // request signatures are apparently expected in seconds
      expires: now + 300,
      alg: signer.algorithm,
      keyid: key.kid,
      tag: 'http-message-signatures-directory',
    },
  });
}

/**
 * Directory of public keys as JWK with expiry data that may or may not get used by Cloudflare but their API returns it.
 * @returns A Promise that resolves to the active key directory
 */
export async function getSignedKeyDirectory(
  authority: string
): Promise<SignedBotSignDirectory> {
  await rotateAndGetFreshKeyPair(); // this should be a cronjob, probably
  const keys = await db
    .ref('bot-signatures/key-directory')
    .orderByChild('exp')
    .get();
  const directory: BotSignKeyPair[] = [];
  keys.forEach(child => {
    const keyPair = child.val() as BotSignKeyPair;
    directory.push(keyPair);
  });
  const now = Math.floor(Date.now() / 1000);
  return {
    directory: {
      keys: directory.map(key => ({
        exp: key.exp,
        nbf: key.nbf,
        kid: key.kid,
        crv: key.pubKey.crv,
        x: key.pubKey.x,
        kty: key.pubKey.kty,
      })),
    },
    signatureData: await Promise.all(
      directory.map((key, idx) =>
        signDirectoryEntry(now, authority, key, `binding${idx + 1}`)
      )
    ),
  };
}

/**
 * Like regular {@link fetch}, but signs the request. Note that this
 * function resets the UA to a Cloudflare-approved value.
 *
 * @param input See {@link fetch}
 * @param init See {@link fetch}
 * @returns See {@link fetch}
 */
export async function signedFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const now = new Date();
  const keyPair = await rotateAndGetFreshKeyPair();

  const originalRequest = new Request(input, init);
  const headers = originalRequest.headers;
  // CF does not like signed requests with fake UAs
  headers.set('User-Agent', signingConfig.userAgent);
  headers.append('Signature-Agent', signingConfig.signatureAgent);
  const unsignedRequest = new Request(originalRequest, { headers });
  const fields = await sign(unsignedRequest, {
    signer: await signerFromJWK(keyPair.privKey),
    created: now,
    expires: new Date(now.getTime() + 60_000),
    nonce: generateNonce(),
  });
  headers.append('Signature', fields.signature);
  headers.append('Signature-Input', fields.signatureInput);
  const signedRequest = new Request(unsignedRequest, { headers });
  return fetch(signedRequest);
}
