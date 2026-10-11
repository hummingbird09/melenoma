export type Tier = 'low' | 'med' | 'high'

export function riskTier(score: number): Tier {
  if (score < 0.35) return 'low'
  if (score < 0.65) return 'med'
  return 'high'
}

export const TIER = {
  low: { label: 'Low risk', color: 'var(--low)', soft: 'var(--low-soft)' },
  med: { label: 'Watch closely', color: 'var(--med)', soft: 'var(--med-soft)' },
  high: { label: 'See a dermatologist', color: 'var(--high)', soft: 'var(--high-soft)' },
} as const

export default function RiskLens({
  score,
  size = 56,
}: {
  score: number | null
  size?: number
}) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const tier = score === null ? null : riskTier(score)
  const color = tier ? TIER[tier].color : 'var(--line)'
  const filled = score === null ? 0 : Math.max(0.02, score)
  const showText = size >= 96

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={
        score === null ? 'No scans yet' : `${TIER[tier!].label}, score ${Math.round(score * 100)}%`
      }
      className="shrink-0"
    >
      {/* ruler ticks, like the edge of a dermoscope lens */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 10 * Math.PI) / 180
        const long = i % 3 === 0
        const r1 = long ? 45.5 : 47
        const r2 = 49.5
        return (
          <line
            key={i}
            x1={50 + r1 * Math.sin(angle)}
            y1={50 - r1 * Math.cos(angle)}
            x2={50 + r2 * Math.sin(angle)}
            y2={50 - r2 * Math.cos(angle)}
            stroke="var(--line)"
            strokeWidth={long ? 1.4 : 1}
          />
        )
      })}
      <circle cx="50" cy="50" r={radius} fill="var(--surface)" stroke="var(--line)" strokeWidth="7" />
      {score !== null ? (
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      ) : null}
      {showText ? (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="20"
          fontWeight="600"
          fill="var(--ink)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {score === null ? '–' : `${Math.round(score * 100)}%`}
        </text>
      ) : null}
    </svg>
  )
}