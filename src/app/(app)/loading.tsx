export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6 max-w-3xl">
      <div className="h-8 w-48 bg-white/5 rounded-lg" />
      <div className="h-4 w-72 bg-white/5 rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-white/5 rounded-2xl" />
        <div className="h-24 bg-white/5 rounded-2xl" />
      </div>
      <div className="h-64 bg-white/5 rounded-2xl" />
    </div>
  );
}
