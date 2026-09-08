import firebaseApp from '../../src/firebaseAdmin';

import { generateNonce, sign } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';
import {
  createSignature,
  RequestDescriptor,
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
 * Generate a new signing keypair regardless of age.
 */
export async function rotateKey(): Promise<BotSignKeyPair> {
  const keysRef = db.ref('bot-signatures/key-directory');
  const keyPair = await generateKey();
  const privKey = await subtle.exportKey('jwk', keyPair.privateKey);
  const pubKey = await subtle.exportKey('jwk', keyPair.publicKey);
  pubKey.alg = privKey.alg = 'EdDSA';
  const signer = await signerFromJWK(privKey);
  const now = Date.now();
  const key: BotSignKeyPair = {
    privKey,
    pubKey,
    kid: signer.keyid,
    nbf: now - 60 * 1000, // clock desync (not sure if CF is using this field though)
    exp: now + 30 * 24 * 60 * 60 * 1000,
  };
  keysRef.push(key);
  return key;
}

/**
 * Rotate old keys, remove expired ones.
 */
export async function rotateKeyIfNeeded() {
  let rotate = true;
  const keys = await db
    .ref('bot-signatures/key-directory')
    .orderByChild('exp')
    .get();

  keys.forEach(child => {
    const keyPair = child.val() as BotSignKeyPair;
    const now = Date.now();
    if (keyPair.exp > now + 7 * 24 * 60 * 60 * 1000) {
      rotate = false;
      return true;
    } else if (keyPair.exp < now - 60 * 1000) {
      child.ref.remove();
    }
  });

  if (rotate) {
    rotateKey();
  }
}

/**
 * Directory of public keys as JWK with expiry data that may or may not get used by Cloudflare but their API returns it.
 * @returns A Promise that resolves to the active key directory
 */
export async function getSignedKeyDirectory(
  authority: string
): Promise<SignedBotSignDirectory> {
  const keys = await db
    .ref('bot-signatures/key-directory')
    .orderByChild('exp')
    .get();
  const directory: BotSignKeyPair[] = [];
  keys.forEach(child => {
    const keyPair = child.val() as BotSignKeyPair;
    directory.push(keyPair);
  });
  const request: RequestDescriptor = {
    kind: 'request',
    method: 'GET',
    targetUri: `https://${authority}/.well-known/http-message-signatures-directory`,
    fields: [{ name: 'req', value: 'true' }],
  };
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
      directory.map(async (key, idx) => {
        const signer = webcrypto.signer(
          await subtle.importKey(
            'jwk',
            key.privKey,
            { name: 'Ed25519' },
            false,
            ['sign']
          )
        );
        return await createSignature(request, {
          label: `sig${idx + 1}`,
          components: ['@authority', 'req'],
          parameters: {
            created: Date.now(),
            expires: Date.now() + 300_000,
            alg: signer.algorithm,
            keyid: key.kid,
            tag: 'http-message-signatures-directory',
          },
          signer,
        });
      })
    ),
  };
}

export async function signedFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const now = new Date();
  const keys = await db
    .ref('bot-signatures/key-directory')
    .orderByChild('exp')
    .startAt(now.getTime())
    .limitToLast(1)
    .get();
  let keyPair: BotSignKeyPair | undefined = undefined;
  keys.forEach(child => {
    keyPair = child.val() as BotSignKeyPair;
  });
  if (!keyPair) {
    keyPair = await rotateKey();
  }

  const originalRequest = new Request(input, init);
  const headers = originalRequest.headers;
  headers.append('Signature-Agent', signingConfig.signatureAgent);
  const unsignedRequest = new Request(originalRequest, { headers });
  const fields = await sign(unsignedRequest, {
    signer: await signerFromJWK(keyPair.privKey),
    created: now,
    expires: new Date(now.getTime() + 300 * 1000),
    nonce: generateNonce(),
  });
  headers.append('Signature', fields.signature);
  headers.append('Signature-Input', fields.signatureInput);
  const signedRequest = new Request(originalRequest, { headers });
  return fetch(signedRequest);
}
