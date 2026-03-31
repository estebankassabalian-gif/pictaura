import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJobZip } from "@/services/processing/zip";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    const { stream, filename } = await generateJobZip(
      jobId,
      session.user.id
    );

    // Streamer le ZIP directement en réponse
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "'").replace(/[\r\n]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ZIP generation error:", error);
    return NextResponse.json(
      { error: "Impossible de générer le ZIP" },
      { status: 500 }
    );
  }
}
