import { ImportForm } from "./import-form";

export const runtime = "nodejs";
export const maxDuration = 60;

export default function BulkImportPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-8 w-full">
      <h1 className="text-2xl font-semibold mb-2">Bulk import listings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Paste the URLs from your favorites (or the HTML you copied) and we&apos;ll
        add them one by one. Keep this tab open until it finishes — each URL
        takes about 10–15 seconds.
      </p>
      <ImportForm />
    </main>
  );
}
