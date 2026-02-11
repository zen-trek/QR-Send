import React, { useMemo } from 'react';

interface ExpenseGraphProps {
  data: number[];
  labels: string[];
  type: 'bar' | 'line';
  max: number;
}

export const ExpenseGraph: React.FC<ExpenseGraphProps> = ({ data, labels, type, max }) => {
  // normalize max to avoid division by zero and add some headroom
  const chartMax = max > 0 ? max * 1.2 : 100;

  const points = useMemo(() => {
    if (type !== 'line') return '';
    const width = 100;
    const step = width / (data.length - 1 || 1);
    
    // Create smooth bezier curve path
    const pts = data.map((val, i) => {
      const x = i * step;
      const y = 100 - (val / chartMax) * 100;
      return `${x},${y}`;
    });

    if (pts.length < 2) return `0,100 100,100`;

    let d = `M ${pts[0]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1].split(',').map(Number);
      const [x1, y1] = pts[i].split(',').map(Number);
      const cp1x = x0 + (x1 - x0) * 0.5;
      const cp1y = y0;
      const cp2x = x1 - (x1 - x0) * 0.5;
      const cp2y = y1;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`;
    }
    return d;
  }, [data, chartMax, type]);

  return (
    <div className="w-full h-48 relative select-none">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        {/* Background Grid Lines */}
        <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {type === 'bar' && data.map((value, i) => {
          const barHeight = (value / chartMax) * 100;
          const barWidth = 60 / data.length; // Dynamic width based on item count
          const x = (i * (100 / data.length)) + (50 / data.length) - (barWidth / 2);
          
          return (
            <g key={i} className="transition-all duration-500 ease-spring">
              {/* Background Bar */}
              <rect
                x={x}
                y={0}
                width={barWidth}
                height={100}
                rx={1} // soft rounded
                className="fill-zinc-100 dark:fill-zinc-800/50"
              />
              {/* Value Bar */}
              <rect
                x={x}
                y={100 - barHeight}
                width={barWidth}
                height={barHeight}
                rx={1}
                className="fill-indigo-500 transition-all duration-500 ease-spring"
              />
            </g>
          );
        })}

        {type === 'line' && (
          <>
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Fill Area */}
            <path
              d={`${points} L 100,100 L 0,100 Z`}
              fill="url(#lineGradient)"
              className="transition-all duration-500 ease-spring"
            />
            {/* Stroke Line */}
            <path
              d={points}
              fill="none"
              stroke="rgb(99 102 241)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              className="transition-all duration-500 ease-spring"
            />
          </>
        )}
      </svg>

      {/* Labels */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-6 flex justify-between px-1">
        {labels.map((label, i) => (
          <span 
            key={i} 
            className="text-[9px] font-bold text-zinc-400 uppercase text-center w-full"
            style={{ opacity: (data.length > 15 && i % 5 !== 0) ? 0 : 1 }} // Hide intermediate labels for monthly view
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};