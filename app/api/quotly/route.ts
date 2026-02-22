import { NextResponse } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const runtime = "nodejs"; // penting untuk canvas

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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

function wrapText(ctx: any, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const m = ctx.measureText(test).width;
    if (m > maxWidth && line) {
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
  // PENTING: gunakan proxy kamu biar menghindari CORS/limit/cek image
  // (kalau mau langsung juga boleh, tapi proxy lebih aman)
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const name = (searchParams.get("name") || "hydra").slice(0, 40);
  const textRaw = searchParams.get("text") || "halo guys anjay";
  const text = textRaw.slice(0, 400); // batasi biar GET ga kebablasan
  const avatar = searchParams.get("avatar") || "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

  // ukuran + layout mirip contoh kamu
  const W = 1600;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background hitam
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // bubble putih
  const bubbleX = 340;
  const bubbleY = 120;
  const bubbleW = 1200;
  const bubbleH = 520;
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 90);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // avatar lingkaran kiri
  const avX = 120;
  const avY = 120;
  const avSize = 220;

  // ambil avatar (kalau mau pakai proxy kamu: /api/image?url=...)
  const avatarUrl = avatar.startsWith("http")
    ? avatar
    : "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

  const avBuf = await fetchImageAsBuffer(avatarUrl);
  const avImg = await loadImage(avBuf);

  ctx.save();
  ctx.beginPath();
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avImg, avX, avY, avSize, avSize);
  ctx.restore();

  // text area
  const textX = bubbleX + 110;
  const nameY = bubbleY + 180;
  const msgYStart = bubbleY + 320;
  const maxTextWidth = bubbleW - 180;

  // username (orange)
  ctx.font = "bold 120px Arial";
  ctx.fillStyle = "#f59e0b";
  ctx.fillText(name, textX, nameY);

  // message (black)
  const fontSize = 120;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = "#111";

  const lines = wrapText(ctx, text, maxTextWidth);
  const lineHeight = Math.floor(fontSize * 1.1);

  // kalau kepanjangan, crop jadi beberapa baris
  const maxLines = 3;
  const used = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    used[maxLines - 1] = used[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }

  used.forEach((ln, i) => {
    ctx.fillText(ln, textX, msgYStart + i * lineHeight);
  });

  const png = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(png), {
  headers: {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  },
});
}
