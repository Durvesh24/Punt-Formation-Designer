import type { Formation } from '../store/types';

/** Compressed representation of a punt: [number, x, y, rotation, colorFront, colorBack] */
type CompressedPunt = [number, number, number, number, string, string];

interface SharedShapePayload {
  name: string;
  punts: CompressedPunt[];
}

/** Serialize a shape formation into a compressed, shareable base64 string */
export const serializeShape = (form: Formation): string => {
  const compact: CompressedPunt[] = form.punts.map((p) => [
    p.number,
    Math.round(p.x),
    Math.round(p.y),
    Math.round(p.rotation),
    p.colorFront || 'off',
    p.colorBack || 'off',
  ]);

  const payload: SharedShapePayload = {
    name: form.name,
    punts: compact,
  };

  const jsonStr = JSON.stringify(payload);
  // Using encodeURIComponent + unescape + btoa to support unicode safe base64 encoding (e.g. Marathi names)
  return btoa(unescape(encodeURIComponent(jsonStr)));
};

/** Deserialize a compressed base64 string back into a shape payload */
export const deserializeShape = (b64: string): SharedShapePayload | null => {
  try {
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.name === 'string' && Array.isArray(parsed.punts)) {
      return parsed as SharedShapePayload;
    }
  } catch (e) {
    console.error('Failed to deserialize shape', e);
  }
  return null;
};
