"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { severityLabel } from "@/lib/pain-scale";

/**
 * Severity over the life of one episode.
 *
 * Treatment events are drawn as dashed vertical markers so it is visible where
 * something was taken relative to a change in level. That is a visual
 * coincidence, not evidence of an effect, and nothing here labels it as one.
 *
 * The chart is decorative: the same readings are listed as text underneath, and
 * a summary is exposed to screen readers below.
 */

export interface PainChartPoint {
  time: number;
  severity: number;
  note: string | null;
}

export interface PainChartMarker {
  time: number;
  label: string;
}

export function PainChart({
  points,
  markers = [],
}: {
  points: readonly PainChartPoint[];
  markers?: readonly PainChartMarker[];
}) {
  if (points.length === 0) return null;

  const single = points.length === 1;

  return (
    <figure className="space-y-2">
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={[...points]}
            margin={{ top: 8, right: 12, bottom: 4, left: -20 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => format(new Date(value), "HH:mm")}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
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
              labelFormatter={(value) => format(new Date(Number(value)), "d MMM, HH:mm")}
              formatter={(value) => {
                const severity = Number(value);
                return [`${severity}/10 - ${severityLabel(severity)}`, "Pain"];
              }}
            />
            {markers.map((marker) => (
              <ReferenceLine
                key={`${marker.time}-${marker.label}`}
                x={marker.time}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: marker.label,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="severity"
              stroke="var(--primary)"
              strokeWidth={2}
              // A single reading has no line to draw, so make sure its dot shows.
              dot={{ r: single ? 5 : 3, fill: "var(--primary)" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sr-only">
        Pain level over time, from {format(new Date(points[0].time), "d MMM HH:mm")} to{" "}
        {format(new Date(points[points.length - 1].time), "d MMM HH:mm")}. Readings:{" "}
        {points
          .map(
            (point) =>
              `${format(new Date(point.time), "HH:mm")} - ${point.severity} out of 10`,
          )
          .join("; ")}
        .
      </figcaption>
    </figure>
  );
}
