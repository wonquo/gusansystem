import { Skeleton } from "@/components/ui/skeleton";

export default function CrmLoading() {
  return (
    <div className="mx-auto max-w-[1540px] space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-8 w-48 rounded" />
        </div>
        <Skeleton className="hidden h-10 w-36 rounded md:block" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[132px] rounded-lg border border-[#dbe3ee] bg-white p-5 shadow-[0_10px_34px_rgba(20,35,65,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
              <Skeleton className="size-11 rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-3 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton tall />
    </div>
  );
}

function PanelSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-[#dbe3ee] bg-white p-5 shadow-[0_10px_34px_rgba(20,35,65,0.06)] ${
        tall ? "min-h-[360px]" : "min-h-[280px]"
      }`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: tall ? 7 : 5 }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
