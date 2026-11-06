import type { IScoreTrendChartProps } from './ScoreTrendChart.types';

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const CHART_LEFT = 36;
const CHART_RIGHT = 10;
const CHART_TOP = 12;
const CHART_BOTTOM = 30;
const MAX_SCORE = 10;

const formatDateLabel = (value: string): string => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

export const ScoreTrendChart = (props: IScoreTrendChartProps) => {
  const { points } = props;
  const chartWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const chartHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const plottedPoints = points.map((point, index) => {
    const score = Math.max(0, Math.min(MAX_SCORE, point.avgScore));
    return {
      ...point,
      label: formatDateLabel(point.date),
      x:
        points.length === 1
          ? CHART_LEFT + chartWidth / 2
          : CHART_LEFT + (index / (points.length - 1)) * chartWidth,
      y: CHART_TOP + chartHeight * (1 - score / MAX_SCORE),
    };
  });
  const linePath = plottedPoints.map(({ x, y }) => `${x},${y}`).join(' L');
  const areaPath = plottedPoints.length
    ? `M${linePath} L${plottedPoints.at(-1)!.x},${CHART_HEIGHT - CHART_BOTTOM} L${plottedPoints[0].x},${CHART_HEIGHT - CHART_BOTTOM} Z`
    : '';
  const scoreDescription = plottedPoints
    .map(({ label, avgScore }) => `${label}: ${avgScore.toFixed(1)}/10`)
    .join(', ');

  return (
    <svg
      role="img"
      aria-label={`Score trend for the last ${points.length} sessions: ${scoreDescription}`}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-40 w-full overflow-visible"
    >
      {[MAX_SCORE, MAX_SCORE / 2, 0].map((score) => {
        const y = CHART_TOP + chartHeight * (1 - score / MAX_SCORE);
        return (
          <g key={score} aria-hidden="true">
            <line
              x1={CHART_LEFT}
              x2={CHART_WIDTH - CHART_RIGHT}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
            <text
              x={CHART_LEFT - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-[var(--dim)] text-[10px]"
            >
              {score}
            </text>
          </g>
        );
      })}
      {plottedPoints.length > 0 && (
        <>
          <path d={areaPath} fill="var(--accent-bg)" aria-hidden="true" />
          <path
            data-score-trend-line
            d={`M${linePath}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          />
          {plottedPoints.map((point) => (
            <g key={point.date} aria-hidden="true">
              <circle
                data-score-trend-point
                cx={point.x}
                cy={point.y}
                r="4"
                fill="var(--accent)"
                stroke="var(--card)"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={CHART_HEIGHT - 7}
                textAnchor="middle"
                className="fill-[var(--dim)] text-[10px]"
              >
                {point.label}
              </text>
            </g>
          ))}
        </>
      )}
    </svg>
  );
};
