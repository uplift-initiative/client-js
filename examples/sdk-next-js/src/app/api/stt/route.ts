import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/uplift";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const model = (formData.get("model") as string) || "scribe";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const client = getClient();

  const result = await client.stt.transcribe({
    file: buffer,
    fileName: file.name,
    model: model as "scribe" | "scribe-mini",
    language: "ur",
  });

  return NextResponse.json(result);
}
