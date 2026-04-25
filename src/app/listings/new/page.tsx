import { NewListingForm } from "./new-listing-form";

export const runtime = "nodejs";
export const maxDuration = 60;

export default function NewListingPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto p-8 w-full">
      <h1 className="text-2xl font-semibold mb-6">Add a listing</h1>
      <NewListingForm />
    </main>
  );
}
