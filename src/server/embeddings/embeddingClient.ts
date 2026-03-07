const MODEL_VERSION = 'all-MiniLM-L6-v2@384';
const EXPECTED_DIM = 384;
const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;

/** True when using HF free Inference Providers API via SDK (no custom URL). */
function isHuggingFaceSdkConfig(): boolean {
  const key = EMBEDDING_API_KEY?.trim();
  return Boolean(key?.startsWith('hf_') && !EMBEDDING_API_URL);
}

function requireConfig(): void {
  if (isHuggingFaceSdkConfig()) return;
  if (EMBEDDING_API_URL) return;
  throw new Error(
    'Embedding config missing. Either: (1) Set EMBEDDING_API_KEY=hf_xxx for HF free tier (leave EMBEDDING_API_URL unset), or (2) Set EMBEDDING_API_URL for a custom endpoint.'
  );
}

export interface EmbeddingProvider {
  readonly modelVersion: string;
  embed(text: string): Promise<number[]>;
}

/** Uses @huggingface/inference SDK — routes to HF Inference Providers (free tier). */
class HuggingFaceSdkProvider implements EmbeddingProvider {
  readonly modelVersion = MODEL_VERSION;

  async embed(text: string): Promise<number[]> {
    requireConfig();
    const { InferenceClient } = await import('@huggingface/inference');
    const client = new InferenceClient(EMBEDDING_API_KEY!.trim());

    const result = await client.featureExtraction({
      model: HF_MODEL,
      inputs: text,
      provider: 'hf-inference',
    });

    const vector = Array.isArray(result)
      ? (Array.isArray(result[0]) ? (result[0] as number[]) : (result as number[]))
      : undefined;

    if (!vector || !Array.isArray(vector)) {
      throw new Error('Hugging Face SDK returned unexpected embedding format');
    }
    if (vector.length !== EXPECTED_DIM) {
      throw new Error(`Embedding dimension mismatch. Expected ${EXPECTED_DIM}, got ${vector.length}`);
    }
    return vector;
  }
}

/** Uses raw HTTP for custom embedding endpoints (OpenAI-compatible, etc.). */
class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly modelVersion = MODEL_VERSION;

  async embed(text: string): Promise<number[]> {
    requireConfig();
    const url = EMBEDDING_API_URL!;

    const isHuggingFace = url.includes('huggingface.co');
    const body = isHuggingFace
      ? JSON.stringify({ inputs: text })
      : JSON.stringify({
          model: HF_MODEL,
          input: text,
        });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { Authorization: `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Embedding API error: ${res.status} ${res.statusText} ${body ? `- ${body}` : ''}`.trim()
      );
    }

    const json = (await res.json()) as
      | { embedding?: number[] }
      | { data?: { embedding: number[] }[] }
      | number[][]
      | number[];
    let vector: number[] | undefined;

    if (Array.isArray(json) && Array.isArray(json[0])) {
      vector = json[0] as number[];
    } else if (Array.isArray(json) && typeof json[0] === 'number') {
      vector = json as number[];
    } else if ('embedding' in json && Array.isArray((json as { embedding?: number[] }).embedding)) {
      vector = (json as { embedding: number[] }).embedding;
    } else if ('data' in json && Array.isArray((json as { data?: { embedding: number[] }[] }).data) && (json as { data: { embedding: number[] }[] }).data[0]?.embedding) {
      vector = (json as { data: { embedding: number[] }[] }).data[0].embedding;
    }

    if (!vector || !Array.isArray(vector)) {
      throw new Error('Embedding API response missing "embedding" array');
    }
    if (vector.length !== EXPECTED_DIM) {
      throw new Error(`Embedding dimension mismatch. Expected ${EXPECTED_DIM}, got ${vector.length}`);
    }
    return vector;
  }
}

let provider: EmbeddingProvider | null = null;

function getProvider(): EmbeddingProvider {
  if (!provider) {
    provider = isHuggingFaceSdkConfig()
      ? new HuggingFaceSdkProvider()
      : new HttpEmbeddingProvider();
  }
  return provider;
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot embed empty text');
  }
  const p = getProvider();
  return p.embed(trimmed);
}

export function getEmbeddingModelVersion(): string {
  return MODEL_VERSION;
}

