import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "crm-documents";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase storage not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function isStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadDocument(params: {
  clientId: string;
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<string> {
  const ts = Date.now();
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._\-֐-׿]/g, "_");
  const path = `${params.clientId}/${ts}-${safeName}`;

  const { error } = await getClient().storage.from(BUCKET).upload(path, params.buffer, {
    contentType: params.mimeType || "application/octet-stream",
    upsert: false,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function createSignedUrl(storagePath: string, expiresInSec = 60): Promise<string> {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function deleteDocument(storagePath: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
