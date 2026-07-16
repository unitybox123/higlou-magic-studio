import { ImageAnnotatorClient } from "@google-cloud/vision";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";

/**
 * Reusable Google Cloud Vision client authenticated with a Service Account.
 * Credentials stay server-side only — never use NEXT_PUBLIC_* or API keys.
 */
let client: ImageAnnotatorClient | null = null;

export function isGoogleVisionEnabled(): boolean {
  return AI_PROVIDER_DEFAULTS.googleVisionEnabled;
}

export function isGoogleVisionConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL &&
      process.env.GOOGLE_CLOUD_PRIVATE_KEY,
  );
}

export function getGoogleVisionCredentials() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  };
}

export function getGoogleVisionClient(): ImageAnnotatorClient | null {
  if (!isGoogleVisionEnabled()) return null;
  if (!isGoogleVisionConfigured()) return null;

  if (!client) {
    const auth = getGoogleVisionCredentials();
    if (!auth) return null;

    client = new ImageAnnotatorClient({
      projectId: auth.projectId,
      credentials: auth.credentials,
    });
  }

  return client;
}

/** Test helper — clears the singleton between unit tests. */
export function resetGoogleVisionClientForTests() {
  client = null;
}
