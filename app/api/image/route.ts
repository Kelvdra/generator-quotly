import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, message: "Missing url" }, { status: 400 });

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json({ ok: false, message: "Upstream failed" }, { status: 502 });
  }

  const ct = upstream.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await upstream.arrayBuffer());

  return new NextResponse(buf, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
