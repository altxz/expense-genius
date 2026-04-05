import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push helpers — minimal implementation for Deno
async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const privateKeyBytes = base64urlToUint8Array(privateKeyB64);
  const publicKeyBytes = base64urlToUint8Array(publicKeyB64);

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: uint8ToBase64url(publicKeyBytes.slice(1, 33)),
      y: uint8ToBase64url(publicKeyBytes.slice(33, 65)),
      d: uint8ToBase64url(privateKeyBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { privateKey, publicKeyBytes };
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function uint8ToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJwt(
  endpoint: string,
  subject: string,
  privateKey: CryptoKey
): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = uint8ToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ToBase64url(enc.encode(JSON.stringify(payload)));

  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );

  return `${headerB64}.${payloadB64}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

// ECDH + HKDF + AES-128-GCM encryption for Web Push
async function encryptPayload(
  payload: string,
  subscriptionPublicKey: string,
  authSecret: string
) {
  const clientPublicKeyBytes = base64urlToUint8Array(subscriptionPublicKey);
  const authBytes = base64urlToUint8Array(authSecret);

  // Generate ephemeral ECDH key pair
  const localKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeys.publicKey)
  );

  // Import subscriber public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeys.privateKey,
      256
    )
  );

  const enc = new TextEncoder();

  // HKDF to derive auth_info keying material
  const authInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...clientPublicKeyBytes,
    ...localPublicKeyRaw,
  ]);

  const authHkdfKey = await crypto.subtle.importKey(
    "raw",
    authBytes,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: sharedSecret, info: authInfo },
      authHkdfKey,
      256
    )
  );

  // Derive content encryption key (CEK) and nonce
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);

  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikmKey,
    128
  );

  const nonceInfo = enc.encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey,
    96
  );

  // Encrypt
  const cek = await crypto.subtle.importKey(
    "raw",
    cekBits,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const payloadBytes = enc.encode(payload);
  // Add padding delimiter (0x02 = final record)
  const padded = new Uint8Array(payloadBytes.length + 1);
  padded.set(payloadBytes);
  padded[payloadBytes.length] = 2;

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits },
      cek,
      padded
    )
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = payloadBytes.length + 1 + 16 + 1; // content + padding + tag overhead + delimiter
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096); // record size
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);

  return body;
}

async function sendPushNotification(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: { title: string; body: string; icon?: string; url?: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const { privateKey, publicKeyBytes } = await importVapidKeys(
    vapidPublicKey,
    vapidPrivateKey
  );

  const jwt = await createJwt(subscription.endpoint, vapidSubject, privateKey);

  const payloadStr = JSON.stringify(payload);
  const encryptedPayload = await encryptPayload(
    payloadStr,
    subscription.keys_p256dh,
    subscription.keys_auth
  );

  const vapidPublicKeyB64 = uint8ToBase64url(publicKeyBytes);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKeyB64}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encryptedPayload,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed [${response.status}]: ${text}`);
  }

  return response.status;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = "BLDozEgmiWfN09WbaPJ8BaTrSfCjGZAiinZzxYq8cZqWS-BW87hFCuxcypwhE5stMBRsi7Mpd3qFHbzRoK-PbeA";

    if (!vapidPrivateKey) {
      throw new Error("VAPID_PRIVATE_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, title, message } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions for this user
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const status = await sendPushNotification(
          sub,
          { title, body: message, icon: "/pwa-icon-192.png", url: "/" },
          vapidPublicKey,
          vapidPrivateKey,
          "mailto:notifications@lumnia.app"
        );
        if (status === 201) sent++;
      } catch (err: any) {
        failed++;
        // 404 or 410 = subscription expired, clean up
        if (err.message?.includes("[404]") || err.message?.includes("[410]")) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.error(`Push error for ${sub.endpoint}:`, err.message);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, cleaned: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
