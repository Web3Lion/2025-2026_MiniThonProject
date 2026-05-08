/**
 * NFT Image Compositor
 *
 * Stacks trait PNG layers in layer-order onto a 1000×1000 canvas.
 * Layer order is determined by the folder prefix number: 01_, 02_, etc.
 * All images must be 1000×1000 PNG with transparency (except background).
 *
 * This runs entirely client-side — no server needed.
 */

export interface LayerImage {
  category: string;   // e.g. "background", "body"
  layerOrder: number; // parsed from folder prefix: "01_background" → 1
  traitName: string;  // display name
  imageFile: string;  // filename
  imageData: string;  // base64 data URI
}

export const NFT_SIZE = 1000;

/**
 * Parse layer order from folder/category name.
 * "01_background" → 1, "03_eyes" → 3, "background" → 99 (no prefix = last)
 */
export function parseLayerOrder(folderName: string): number {
  const match = folderName.match(/^(\d+)[_-]/);
  return match ? parseInt(match[1], 10) : 99;
}

/**
 * Parse tier from filename suffix.
 * "bluepants#2.png" → { name: "Blue Pants", tier: 2 }
 * "sunset.png"      → { name: "Sunset", tier: 1 }
 */
export function parseTraitFilename(filename: string): { displayName: string; tier: number } {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const match = withoutExt.match(/^(.+?)#(\d+)$/);

  if (match) {
    const rawName = match[1];
    const tier = Math.min(5, Math.max(1, parseInt(match[2], 10)));
    const displayName = rawName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return { displayName, tier };
  }

  // No tier suffix — default to tier 1
  const displayName = withoutExt
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return { displayName, tier: 1 };
}

/**
 * Read a File as a base64 data URI
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Load an image element from a data URI
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Composite multiple layer images onto a 1000×1000 canvas.
 * Layers are drawn in ascending layerOrder.
 * Returns a base64 PNG data URI of the final image.
 */
export async function compositeNFT(layers: LayerImage[]): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = NFT_SIZE;
  canvas.height = NFT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Sort by layer order ascending (01_ first, 06_ last)
  const sorted = [...layers].sort((a, b) => a.layerOrder - b.layerOrder);

  for (const layer of sorted) {
    try {
      const img = await loadImage(layer.imageData);
      ctx.drawImage(img, 0, 0, NFT_SIZE, NFT_SIZE);
    } catch {
      console.warn(`Failed to load layer: ${layer.traitName} — skipping`);
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Convert a base64 data URI to a Blob (for IPFS upload)
 */
export function dataUriToBlob(dataUri: string): Blob {
  const [header, data] = dataUri.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a PNG blob to IPFS via Pinata
 * Returns the IPFS URI: ipfs://CID
 */
export async function uploadImageToIPFS(
  imageBlob: Blob,
  filename: string,
  pinataApiKey: string,
  pinataApiSecret: string
): Promise<{ success: boolean; ipfsUri?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", imageBlob, filename);
    formData.append(
      "pinataMetadata",
      JSON.stringify({ name: filename })
    );

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataApiSecret,
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Pinata error: ${res.statusText}`);
    const data = await res.json();
    return { success: true, ipfsUri: `ipfs://${data.IpfsHash}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

/**
 * Upload metadata JSON to IPFS via Pinata
 */
export async function uploadMetadataToIPFS(
  metadata: object,
  name: string,
  pinataApiKey: string,
  pinataApiSecret: string
): Promise<{ success: boolean; ipfsUri?: string; error?: string }> {
  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataApiSecret,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name },
      }),
    });

    if (!res.ok) throw new Error(`Pinata error: ${res.statusText}`);
    const data = await res.json();
    return { success: true, ipfsUri: `ipfs://${data.IpfsHash}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
