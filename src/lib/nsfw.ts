/**
 * On-device explicit-content detection (nsfwjs + TensorFlow.js).
 * Runs entirely in the browser — no frames ever leave the device.
 */
import type { NSFWJS } from "nsfwjs";

let modelPromise: Promise<NSFWJS> | null = null;

export interface NsfwVerdict {
  explicit: boolean;
  borderline: boolean;
  score: number;
  label: string;
}

const SAFE: NsfwVerdict = { explicit: false, borderline: false, score: 0, label: "Neutral" };

export async function loadNsfwModel(): Promise<NSFWJS | null> {
  if (typeof window === "undefined") return null;
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, nsfw] = await Promise.all([import("@tensorflow/tfjs"), import("nsfwjs")]);
      await tf.ready();
      return nsfw.load("MobileNetV2Mid");
    })();
  }
  try {
    return await modelPromise;
  } catch {
    modelPromise = null;
    return null;
  }
}

function verdict(
  preds: { className: string; probability: number }[],
): NsfwVerdict {
  const get = (n: string) => preds.find((p) => p.className === n)?.probability ?? 0;
  const porn = get("Porn");
  const hentai = get("Hentai");
  const sexy = get("Sexy");
  const explicitScore = Math.max(porn, hentai);

  if (explicitScore >= 0.6) {
    return { explicit: true, borderline: false, score: explicitScore, label: porn >= hentai ? "Porn" : "Hentai" };
  }
  if (sexy >= 0.85) {
    return { explicit: true, borderline: false, score: sexy, label: "Sexy" };
  }
  if (explicitScore >= 0.35 || sexy >= 0.6) {
    return { explicit: false, borderline: true, score: Math.max(explicitScore, sexy), label: "Borderline" };
  }
  return SAFE;
}

/** Classify a single frame of a live <video>. Returns a safe verdict on any failure. */
export async function scanVideoFrame(video: HTMLVideoElement): Promise<NsfwVerdict> {
  if (!video.videoWidth || video.readyState < 2) return SAFE;
  const model = await loadNsfwModel();
  if (!model) return SAFE;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    if (!ctx) return SAFE;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return verdict(await model.classify(canvas));
  } catch {
    return SAFE;
  }
}

/** Classify an image the user is about to upload (avatar, payment proof, etc). */
export async function scanImageFile(file: File): Promise<NsfwVerdict> {
  const model = await loadNsfwModel();
  if (!model) return SAFE;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return verdict(await model.classify(img));
  } catch {
    return SAFE;
  } finally {
    URL.revokeObjectURL(url);
  }
}
