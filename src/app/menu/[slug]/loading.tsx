export default function MenuLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950">
      <div className="bg-white/95 dark:bg-slate-900/95 px-4 h-20 flex items-center gap-2.5 border-b border-gray-100/50 dark:border-slate-800/50">
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        </div>
        <div className="h-11 w-24 bg-gray-100 dark:bg-slate-800 rounded-full animate-pulse flex-shrink-0" />
        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-full animate-pulse flex-shrink-0" />
      </div>

      <div className="flex gap-2.5 overflow-hidden px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-200 dark:bg-slate-700 rounded-2xl animate-pulse flex-shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden border border-gray-100/80 dark:border-slate-800/80 animate-pulse">
            <div className="m-2 rounded-[1.4rem] h-32 sm:h-56 bg-gray-100 dark:bg-slate-800" />
            <div className="px-3 pb-4 space-y-2">
              <div className="h-4 w-3/4 bg-gray-100 dark:bg-slate-800 rounded" />
              <div className="h-4 w-1/2 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
