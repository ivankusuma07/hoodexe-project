const GATEWAY = (process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://ipfs.io').replace(/\/$/, '');

/**
 * A token logo as an image URL, or null. Logos come from any Pons launcher, so only ipfs:// (through our
 * gateway) and https:// are accepted; images render with no referrer and load lazily.
 */
export function logoUrl(logo: string): string | null {
  const v = logo.trim();
  const ipfs = /^ipfs:\/\/(?:ipfs\/)?([a-zA-Z0-9]{46,100}(?:\/[\w.-]+)*)$/.exec(v);
  if (ipfs) return `${GATEWAY}/ipfs/${ipfs[1]}`;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Gateway URL for a CID we pinned (theorem metadata). */
export function ipfsUrl(cid: string): string | null {
  return /^[a-zA-Z0-9]{46,100}$/.test(cid) ? `${GATEWAY}/ipfs/${cid}` : null;
}
