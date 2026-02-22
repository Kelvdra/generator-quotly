import type { NextApiRequest, NextApiResponse } from "next";
import { createCanvas } from "@napi-rs/canvas";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, text } = req.query;

  if (!name || !text) {
    return res.status(400).json({
      message: "name and text are required",
    });
  }

  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 800, 400);

  ctx.fillStyle = "white";
  ctx.font = "50px sans-serif";
  ctx.fillText(String(name), 50, 100);
  ctx.fillText(String(text), 50, 170);

  const buffer = canvas.toBuffer("image/png");

  res.setHeader("Content-Type", "image/png");
  return res.status(200).send(buffer);
}
