import { createCanvas, loadImage } from "@napi-rs/canvas";

export const runtime = "nodejs";

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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const name = (searchParams.get("name") || "hydra").slice(0, 40);
  const textRaw = searchParams.get("text") || "halo guys anjay";
  const text = textRaw.slice(0, 400);
  const avatar =
    searchParams.get("avatar") || "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

  // ====== CANVAS INIT (INI WAJIB) ======
  const W = 1600;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background hitam
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // ====== LAYOUT ======
  const avX = 120;
  const avY = 120;
  const avSize = 220;

  const gap = 70; // jarak avatar ke bubble (naikin biar ga mepet)
  const bubbleX = avX + avSize + gap;
  const bubbleY = 90;
  const bubbleW = W - bubbleX - 80;
  const bubbleH = 520;

  // bubble putih
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 90);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // ====== AVATAR ======
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

  // ====== TEXT ======
  const textX = bubbleX + 110;
  const nameY = bubbleY + 190;
  const msgYStart = bubbleY + 330;
  const maxTextWidth = bubbleW - 180;

  // username (orange)
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 120px sans-serif";
  ctx.fillText(name, textX, nameY);

  // message (black)
  const fontSize = 120;
  ctx.fillStyle = "#111";
  ctx.font = `${fontSize}px sans-serif`;

  const lines = wrapText(ctx, text, maxTextWidth);
  const lineHeight = Math.floor(fontSize * 1.12);

  const maxLines = 3;
  const used = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    used[maxLines - 1] = used[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }

  used.forEach((ln, i) => {
    ctx.fillText(ln, textX, msgYStart + i * lineHeight);
  });

  // ====== RETURN PNG ======
  const png = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
