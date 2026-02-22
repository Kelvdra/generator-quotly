"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_AVATAR = "https://telegra.ph/file/1e22e45892774893eb1b9.jpg";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
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

function drawAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function measureTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);

      // hard split kalau kata kepanjangan
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

function proxyUrl(url: string) {
  const u = (url || "").trim();
  if (!u) return "";
  // kalau sudah same-origin (mis. /some.png), biarin
  if (u.startsWith("/")) return u;
  return `/api/image?url=${encodeURIComponent(u)}`;
}

async function loadImage(src: string) {
  if (!src) return null;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // image dari /api/image itu same-origin, jadi aman
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export default function QuotlyCanvasGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [senderName, setSenderName] = useState("hydra");
  const [messageText, setMessageText] = useState("halo");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [bg, setBg] = useState("#000000");

  // ukuran default boleh kamu kunci sesuai kebutuhan
  const [scale, setScale] = useState(2);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(420);

  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ready" | "error"; msg: string }>({
    kind: "idle",
    msg: "",
  });

  const layout = useMemo(() => {
    const s = clamp(Number(scale) || 2, 1, 4);
    const W = clamp(Number(width) || 800, 320, 1400);
    const H = clamp(Number(height) || 420, 240, 1400);
    return { s, W, H };
  }, [scale, width, height]);

  async function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { s, W, H } = layout;

    canvas.width = Math.floor(W * s);
    canvas.height = Math.floor(H * s);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // background hitam
    ctx.fillStyle = bg || "#000000";
    ctx.fillRect(0, 0, W, H);

    setStatus({ kind: "loading", msg: "Rendering..." });

    // IMPORTANT: pakai proxy biar export aman
    let avatarImg: HTMLImageElement | null = null;
    try {
      avatarImg = await loadImage(proxyUrl(avatarUrl || DEFAULT_AVATAR));
    } catch {
      try {
        avatarImg = await loadImage(proxyUrl(DEFAULT_AVATAR));
      } catch {
        avatarImg = null;
      }
    }

    // Layout mirip screenshot
    const padding = 44;
    const avatarSize = 120;
    const gap = 28;

    const bubbleX = padding + avatarSize + gap;
    const bubbleY = padding;
    const bubbleMaxW = W - bubbleX - padding;

    // Typography besar
    const nameColor = "#f7931a";
    const nameFont = "700 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const textFont = "500 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const innerPadX = 46;
    const innerPadTop = 34;
    const innerPadBottom = 34;
    const lineH = 74;

    // avatar bulat
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

    // wrap max: bubble gak boleh kepanjangan (biar “rata”)
    const wrapMax = Math.max(140, bubbleMaxW - innerPadX * 2);
    ctx.font = textFont;
    const msgLines = measureTextLines(ctx, message, wrapMax);

    // bubble auto-shrink / auto-grow
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

    ctx.fillStyle = nameColor;
    ctx.font = nameFont;
    ctx.fillText(name, cx, cy + 60);
    cy += nameH;

    ctx.fillStyle = "#111111";
    ctx.font = textFont;
    for (let i = 0; i < msgLines.length; i++) {
      ctx.fillText(msgLines[i], cx, cy + 68 + i * lineH);
    }

    setStatus({ kind: "ready", msg: "Done" });
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderName, messageText, avatarUrl, bg, layout.s, layout.W, layout.H]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "quotly-canvas.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-neutral-900 rounded-2xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Quotly Generator (Next.js + Canvas)</h1>
            <div className="text-xs text-white/60">{status.kind === "loading" ? "Rendering..." : status.msg}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="font-medium mb-1">Nama</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="font-medium mb-1">Avatar URL</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <div className="text-xs text-white/50 mt-1">Diproses via /api/image agar export PNG aman.</div>
            </label>

            <label className="text-sm md:col-span-2">
              <div className="font-medium mb-1">Message</div>
              <textarea
                className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 min-h-[120px]"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <label className="text-sm">
                <div className="font-medium mb-1">Width</div>
                <input
                  type="number"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                <div className="font-medium mb-1">Height</div>
                <input
                  type="number"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                <div className="font-medium mb-1">Scale</div>
                <input
                  type="number"
                  min={1}
                  max={4}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                <div className="font-medium mb-1">Background</div>
                <input
                  type="color"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 h-[42px]"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={draw} className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90">
              Render ulang
            </button>
            <button
              onClick={downloadPng}
              className="px-4 py-2 rounded-xl border border-white/15 hover:bg-white/5"
            >
              Download PNG
            </button>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-2xl border border-white/10 p-5">
          <div className="text-sm font-medium mb-3">Preview</div>
          <div className="flex justify-center">
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black">
              <canvas ref={canvasRef} />
            </div>
          </div>
          <div className="text-xs text-white/50 mt-3">
            Bubble otomatis menyesuaikan teks: pendek = pendek, panjang = melebar sampai batas lalu turun (rata).
          </div>
        </div>
      </div>
    </div>
  );
}
