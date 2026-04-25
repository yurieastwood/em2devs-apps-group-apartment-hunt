import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto p-8 w-full">
      <h1 className="text-3xl font-semibold mb-3">Apartment Hunt</h1>
      <p className="text-muted-foreground mb-8">
        Save listings from Zillow and Apartments.com to share with family
        during a lease hunt.
      </p>
      <div className="flex flex-col gap-3 items-start">
        <Link
          href="/listings/new"
          className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded"
        >
          Add a listing
        </Link>
      </div>
    </main>
  );
}
