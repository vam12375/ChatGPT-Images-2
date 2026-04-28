import { readGenerationHistory } from "@/lib/generation-history-store";

export const runtime = "nodejs";

function toErrorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

export async function GET(): Promise<Response> {
  try {
    const sessions = await readGenerationHistory();
    return Response.json({ sessions });
  } catch {
    return toErrorResponse("读取最近记录失败");
  }
}
