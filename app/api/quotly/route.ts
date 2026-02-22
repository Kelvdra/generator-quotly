import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";

export const runtime = "nodejs";

// Register font sekali (di module scope)
const fontRegular = path.join(process.cwd(), "public/fonts/Inter-Regular.ttf");
const fontBold = path.join(process.cwd(), "public/fonts/Inter-Bold.ttf");

GlobalFonts.registerFromPath(fontRegular, "Inter");
GlobalFonts.registerFromPath(fontBold, "Inter Bold");

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: any, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
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

  const name = (searchParams.get("name") || "hydra").slice(0, 40);
  const text = (searchParams.get("text") || "halo guys anjay").slice(0, 400);
  const avatar =
    searchParams.get("avatar") || "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

  const W = 1600;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // layout
  const avX = 120, avY = 120, avSize = 220;
  const gap = 70;
  const bubbleX = avX + avSize + gap;
  const bubbleY = 90;
  const bubbleW = W - bubbleX - 80;
  const bubbleH = 520;

  // bubble
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 90);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // avatar
  const avBuf = await fetchImageAsBuffer(avatar);
  const avImg = await loadImage(avBuf);

  ctx.save();
  ctx.beginPath();
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avImg, avX, avY, avSize, avSize);
  ctx.restore();

  // text
  const textX = bubbleX + 110;
  const nameY = bubbleY + 190;
  const msgYStart = bubbleY + 330;
  const maxTextWidth = bubbleW - 180;

  ctx.textBaseline = "alphabetic";

  // username
  ctx.fillStyle = "#f59e0b";
  ctx.font = '120px "Inter Bold"';
  ctx.fillText(name, textX, nameY);

  // message
  ctx.fillStyle = "#111";
  ctx.font = '120px "Inter"';

  const lines = wrapText(ctx, text, maxTextWidth).slice(0, 3);
  const lineHeight = 134;
  lines.forEach((ln, i) => ctx.fillText(ln, textX, msgYStart + i * lineHeight));

  const png = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
