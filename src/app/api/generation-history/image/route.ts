import { readStoredImageFile } from "@/lib/generation-history-store";

export const runtime = "nodejs";

function toErrorResponse(message: string, status = 404): Response {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || "";
  const imageId = searchParams.get("imageId") || "";

  if (!sessionId || !imageId) {
    return toErrorResponse("缺少图片标识", 400);
  }

  try {
    const image = await readStoredImageFile(sessionId, imageId);

    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Type": image.mimeType
      }
    });
  } catch {
    return toErrorResponse("图片文件不存在");
  }
}
