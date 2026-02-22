import { NextResponse } from "next/server";

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
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Invalid image url protocol");
  const res = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Failed fetch image");
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) throw new Error("URL is not an image");
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: Request) {
  const body = (await req.json()) as Payload;
  const name = (body.name || "").trim();
  const text = (body.text || "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "name required" }, { status: 400 });

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
  const nameFont = "700 64px Arial";
  const textFont = "500 64px Arial";

  const innerPadX = 46;
  const innerPadTop = 34;
  const innerPadBottom = 34;
  const lineH = 74;

  ctx.font = textFont;
  const wrapMax = Math.max(140, bubbleMaxW - innerPadX * 2);
  const lines = wrapLines(ctx, text, wrapMax);

  ctx.font = nameFont;
  const nameW = ctx.measureText(name).width;

  ctx.font = textFont;
  let msgW = 0;
  for (const ln of lines) msgW = Math.max(msgW, ctx.measureText(ln).width);

  const contentW = Math.max(nameW, msgW);
  const bubbleW = clamp(contentW + innerPadX * 2, 260, bubbleMaxW);

  const bubbleH = innerPadTop + 70 + 14 + lines.length * lineH + innerPadBottom;

  ctx.fillStyle = "#fff";
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 70);
  ctx.fill();

  // text
  let cx = bubbleX + innerPadX;
  let cy = bubbleY + innerPadTop;

  ctx.fillStyle = nameColor;
  ctx.font = nameFont;
  ctx.fillText(name, cx, cy + 60);
  cy += 70;

  ctx.fillStyle = "#111";
  ctx.font = textFont;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, cy + 68 + i * lineH);
  }

  const png = canvas.toBuffer("image/png");
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
