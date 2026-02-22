import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";

export const runtime = "nodejs";

// ===== Register font (WAJIB supaya text muncul di Vercel) =====
const interRegular = path.join(process.cwd(), "public/fonts/Inter-Regular.ttf");
const interBold = path.join(process.cwd(), "public/fonts/Inter-Bold.ttf");

// Aman: kalau gagal register (misal file belum ada), biar gak crash build
try {
  GlobalFonts.registerFromPath(interRegular, "Inter");
  GlobalFonts.registerFromPath(interBold, "Inter Bold");
} catch {}

const DEFAULT_AVATAR = "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

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

function measureTextLines(ctx: any, text: string, maxWidth: number) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);

      // hard split kalau kata kepanjangan (sama seperti TSX kamu)
      if (ctx.measureText(words[i]).width > maxWidth) {
        let chunk = "";
        for (const ch of words[i]) {
          const t2 = chunk + ch;
          if (ctx.measureText(t2).width <= maxWidth) chunk = t2;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
      } else {
        line = words[i];
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchImageAsBuffer(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const senderName = (searchParams.get("name") || "hydra").slice(0, 40);
  const messageText = (searchParams.get("text") || "halo").slice(0, 400);
  const avatarUrl = searchParams.get("avatar") || DEFAULT_AVATAR;
  const bg = searchParams.get("bg") || "#000000";

  // === Ikutin default TSX kamu: width=800 height=420 scale=2 ===
  const s = clamp(Number(searchParams.get("scale") || 2), 1, 4);
  const W = clamp(Number(searchParams.get("w") || 800), 320, 1400);
  const H = clamp(Number(searchParams.get("h") || 420), 240, 1400);

  // Canvas real size (W*s, H*s) lalu transform s (sama kayak client)
  const canvas = createCanvas(Math.floor(W * s), Math.floor(H * s));
  const ctx = canvas.getContext("2d");

  ctx.setTransform(s, 0, 0, s, 0, 0);

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // === Layout persis dari TSX ===
  const padding = 44;
  const avatarSize = 120;
  const gap = 28;

  const bubbleX = padding + avatarSize + gap;
  const bubbleY = padding;
  const bubbleMaxW = W - bubbleX - padding;

  const nameColor = "#f7931a";
  // pakai font yang kita register biar PASTI muncul
  const nameFont = '700 64px "Inter Bold"';
  const textFont = '500 64px "Inter"';

  const innerPadX = 46;
  const innerPadTop = 34;
  const innerPadBottom = 34;
  const lineH = 74;

  // avatar via fetch (server-side)
  let avatarImg: any | null = null;
  try {
    const avBuf = await fetchImageAsBuffer(avatarUrl);
    avatarImg = await loadImage(avBuf);
  } catch {
    try {
      const avBuf = await fetchImageAsBuffer(DEFAULT_AVATAR);
      avatarImg = await loadImage(avBuf);
    } catch {
      avatarImg = null;
    }
  }

  if (avatarImg) {
    drawAvatar(ctx, avatarImg, padding, bubbleY, avatarSize);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, bubbleY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const name = (senderName || "").trim() || "Unknown";
  const message = (messageText || "").trim();

  const wrapMax = Math.max(140, bubbleMaxW - innerPadX * 2);
  ctx.font = textFont;
  const msgLines = measureTextLines(ctx, message, wrapMax);

  ctx.font = nameFont;
  const nameW = ctx.measureText(name).width;

  ctx.font = textFont;
  let msgW = 0;
  for (const ln of msgLines) msgW = Math.max(msgW, ctx.measureText(ln).width);

  const contentW = Math.max(nameW, msgW);
  const minBubbleW = 260;
  const bubbleW = clamp(contentW + innerPadX * 2, minBubbleW, bubbleMaxW);

  const nameH = 70;
  const msgH = msgLines.length * lineH;
  const bubbleH = innerPadTop + nameH + 14 + msgH + innerPadBottom;

  // bubble putih
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 70);
  ctx.fill();

  // content
  let cx = bubbleX + innerPadX;
  let cy = bubbleY + innerPadTop;

  // Name
  ctx.fillStyle = nameColor;
  ctx.font = nameFont;
  ctx.fillText(name, cx, cy + 60);
  cy += nameH;

  // Message
  ctx.fillStyle = "#111111";
  ctx.font = textFont;
  for (let i = 0; i < msgLines.length; i++) {
    ctx.fillText(msgLines[i], cx, cy + 68 + i * lineH);
  }

  const png = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
