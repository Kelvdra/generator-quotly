import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";

type Payload = {
  name: string;
  text: string;
  avatar?: string; // url
  width?: number;
  height?: number;
  scale?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  const rr = r;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawAvatar(ctx: any, img: any, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function wrapLines(ctx: any, text: string, maxWidth: number) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= maxWidth) line = t;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchImageBuffer(url: string) {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("Invalid image url protocol");
  }

  const res = await fetch(u.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error("Failed fetch image");

  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) throw new Error("URL is not an image");

  return Buffer.from(await res.arrayBuffer());
}

function registerFonts(GlobalFonts: any) {
  // Folder font: /assets/fonts (tidak pakai /public)
  const regularPath = path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf");
  const boldPath = path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf");

  // Supaya gak register berkali-kali
  // (GlobalFonts.has() tergantung versi, jadi kita pakai try-catch aman)
  try {
    // Kalau font family "Inter" sudah ada, skip
    const fams: string[] = GlobalFonts.families ?? [];
    if (Array.isArray(fams) && fams.includes("Inter")) return;
  } catch {
    // ignore
  }

  // Register
  GlobalFonts.registerFromPath(regularPath, "Inter");
  GlobalFonts.registerFromPath(boldPath, "Inter Bold");
}

export async function POST(req: Request) {
  const { createCanvas, loadImage, GlobalFonts } = await import("@napi-rs/canvas");

  // Penting: register font agar text selalu muncul di Vercel
  registerFonts(GlobalFonts);

  const body = (await req.json()) as Payload;

  const name = (body.name || "").trim();
  const text = (body.text || "").trim();

  if (!name) {
    return NextResponse.json({ ok: false, message: "name required" }, { status: 400 });
  }

  const W = clamp(body.width ?? 800, 320, 1400);
  const H = clamp(body.height ?? 420, 240, 1400);
  const s = clamp(body.scale ?? 2, 1, 4);

  // Render di “logical size”, nanti canvas dikali scale
  const canvas = createCanvas(W * s, H * s);
  const ctx = canvas.getContext("2d");

  // scale transform biar gambar tajam
  ctx.scale(s, s);

  // background hitam
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // avatar
  const avatarSize = 120;
  const padding = 44;
  const gap = 28;

  let avatarImg: any = null;
  try {
    const avatarUrl = body.avatar || "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";
    const buf = await fetchImageBuffer(avatarUrl);
    avatarImg = await loadImage(buf);
  } catch {
    avatarImg = null;
  }

  if (avatarImg) drawAvatar(ctx, avatarImg, padding, padding, avatarSize);

  // bubble
  const bubbleX = padding + avatarSize + gap;
  const bubbleY = padding;
  const bubbleMaxW = W - bubbleX - padding;

  const nameColor = "#f7931a";

  // Gunakan font yang kita register (bukan Arial)
  const nameFont = '700 64px "Inter Bold"';
  const textFont = '500 64px "Inter"';

  const innerPadX = 46;
  const innerPadTop = 34;
  const innerPadBottom = 34;
  const lineH = 74;

  // wrap message lines
  ctx.font = textFont;
  const wrapMax = Math.max(140, bubbleMaxW - innerPadX * 2);
  const lines = wrapLines(ctx, text, wrapMax);

  // measure name width
  ctx.font = nameFont;
  const nameW = ctx.measureText(name).width;

  // measure message max line width
  ctx.font = textFont;
  let msgW = 0;
  for (const ln of lines) msgW = Math.max(msgW, ctx.measureText(ln).width);

  const contentW = Math.max(nameW, msgW);
  const bubbleW = clamp(contentW + innerPadX * 2, 260, bubbleMaxW);

  // kalau text kosong, tetap kasih tinggi minimal
  const msgLinesCount = Math.max(1, lines.length);
  const bubbleH = innerPadTop + 70 + 14 + msgLinesCount * lineH + innerPadBottom;

  // draw bubble
  ctx.fillStyle = "#fff";
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 70);
  ctx.fill();

  // draw text
  const cx = bubbleX + innerPadX;
  let cy = bubbleY + innerPadTop;

  // name
  ctx.fillStyle = nameColor;
  ctx.font = nameFont;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(name, cx, cy + 60);
  cy += 70;

  // message
  ctx.fillStyle = "#111";
  ctx.font = textFont;

  if (lines.length === 0) {
    // kalau text kosong, biar nggak terlihat blank banget
    ctx.fillText(" ", cx, cy + 68);
  } else {
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, cy + 68 + i * lineH);
    }
  }

  const png = canvas.toBuffer("image/png"); // Buffer (node)
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
