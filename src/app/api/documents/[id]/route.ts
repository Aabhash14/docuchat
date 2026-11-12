import { deleteDocument } from "@/lib/store";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !(await deleteDocument(id))) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
