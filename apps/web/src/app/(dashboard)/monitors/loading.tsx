import { MonitorsListSkeleton } from "./_components/monitors-list-skeleton";

export default function MonitorsLoading() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="h-9 w-64 bg-muted animate-pulse rounded" />
        <div className="h-5 w-96 bg-muted animate-pulse rounded mt-2" />
      </div>
      <MonitorsListSkeleton />
    </div>
  );
}
