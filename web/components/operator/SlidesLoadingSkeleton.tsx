'use client'

export default function SlidesLoadingSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-[#2a2a2a] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Skeleton cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-[#2a2a2a] border border-[#333] rounded-lg p-4 space-y-3"
            >
              {/* Badge skeleton */}
              <div className="flex gap-2">
                <div className="h-5 w-10 bg-[#1a1a1a] rounded animate-pulse" />
                <div className="h-5 w-16 bg-[#1a1a1a] rounded animate-pulse" />
              </div>

              {/* Content skeleton - multiple lines */}
              <div className="space-y-2">
                <div className="h-3 w-full bg-[#1a1a1a] rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-[#1a1a1a] rounded animate-pulse" />
                <div className="h-3 w-4/6 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
