import { EmptyDocumentError, ingestDocument, listDocuments } from "@/lib/store";
import { isSupported, MAX_UPLOAD_BYTES, UnsupportedFileError } from "@/lib/extract";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ documents: await listDocuments() });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: 'Send the document as multipart form data in a "file" field.' }, { status: 400 });
  }
  if (!isSupported(file.name)) {
    return Response.json({ error: `"${file.name}" isn't supported. Upload a PDF, TXT or Markdown file.` }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: `"${file.name}" is larger than the 10 MB limit.` }, { status: 413 });
  }

  try {
    const document = await ingestDocument(file.name, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof UnsupportedFileError || error instanceof EmptyDocumentError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("upload failed", error);
    return Response.json({ error: `Couldn't read "${file.name}". Is it a valid, unencrypted file?` }, { status: 500 });
  }
}
