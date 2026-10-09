import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import { z } from 'zod';

/** Pins bytes to public IPFS and returns the CID. */
export interface Pinner {
  pin(bytes: Uint8Array, name: string, contentType: string): Promise<string>;
}

const pinataResponse = z.object({ data: z.object({ cid: z.string().min(1) }) });

/** Pinata v3 upload API (uploads.pinata.cloud/v3/files), public network. */
export function pinataPinner(jwt: string): Pinner {
  return {
    async pin(bytes, name, contentType) {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: contentType }), name);
      form.append('network', 'public');
      form.append('name', name);
      const res = await fetch('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Pinata answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return pinataResponse.parse(await res.json()).data.cid;
    },
  };
}

/** The CIDv1 (raw, sha-256) IPFS would assign these bytes. */
export async function rawCid(bytes: Uint8Array): Promise<string> {
  return CID.create(1, raw.code, await sha256.digest(bytes)).toString();
}

/**
 * Dev stand-in without a Pinata key: computes a real-looking CID and keeps the bytes in memory, so
 * the wizard can run end to end on a fork. Nothing is published. Refused in production by env.ts.
 */
export function devPinner(): Pinner & { files: Map<string, { bytes: Uint8Array; contentType: string }> } {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    files,
    async pin(bytes, _name, contentType) {
      const cid = await rawCid(bytes);
      files.set(cid, { bytes, contentType });
      return cid;
    },
  };
}
