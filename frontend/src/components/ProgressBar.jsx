export default function ProgressBar({ value = 0, showLabel = true, size = 'md' }) {
  const pct  = Math.min(100, Math.max(0, Math.round(value)));
  const h    = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary-500' : 'bg-accent-500';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progression</span>
          <span className="font-medium">{pct}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${h} overflow-hidden`}>
        <div
          className={`${h} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
