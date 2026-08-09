"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PeriodPoint } from "@/lib/statistics";

/**
 * Average severity per period.
 *
 * Periods with no readings are absent from the data rather than plotted as
 * zero: a week you did not record anything is not a pain-free week, and
 * drawing it as one would misrepresent the log.
 */
export function TrendChart({ points }: { points: readonly PeriodPoint[] }) {
  if (points.length === 0) return null;

  return (
    <figure className="space-y-2">
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              minTickGap={24}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: "0.875rem",
              }}
              formatter={(value, _name, item) => {
                const point = item?.payload as PeriodPoint | undefined;
                return [
                  `${Number(value)}/10 from ${point?.measurementCount ?? 0} readings`,
                  "Average",
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="averageSeverity"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sr-only">
        Average pain level per period.{" "}
        {points
          .map((point) => `${point.label}: ${point.averageSeverity ?? "no readings"}`)
          .join("; ")}
        .
      </figcaption>
    </figure>
  );
}
