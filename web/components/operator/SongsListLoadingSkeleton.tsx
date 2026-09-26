'use client'

export default function SongsListLoadingSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-2 p-2">
        {/* Skeleton cards */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#333] space-y-2 animate-pulse"
          >
            {/* Title skeleton */}
            <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
            
            {/* Details skeleton */}
            <div className="flex gap-2">
              <div className="h-3 bg-[#1a1a1a] rounded w-1/3" />
              <div className="h-3 bg-[#1a1a1a] rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
