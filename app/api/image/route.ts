import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ ok: false, message: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ ok: false, message: "Only http/https allowed" }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (QuotlyCanvas/1.0)" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, message: `Upstream failed: ${upstream.status}` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ ok: false, message: "URL is not an image" }, { status: 415 });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Image too large" }, { status: 413 });
  }

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
