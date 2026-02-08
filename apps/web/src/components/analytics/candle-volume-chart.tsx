"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketCandle } from "@/lib/api";

interface CandlePoint {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toPoint(candle: MarketCandle): CandlePoint | null {
  const open = Number(candle.openCents);
  const high = Number(candle.highCents);
  const low = Number(candle.lowCents);
  const close = Number(candle.closeCents);

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  return {
    tick: candle.tick,
    open,
    high,
    low,
    close,
    volume: candle.volumeQty
  };
}

function formatCentsRaw(value: number): string {
  return `$${(value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

interface CandleVolumeChartProps {
  candles: MarketCandle[];
}

export function CandleVolumeChart({ candles }: CandleVolumeChartProps) {
  const points = candles.map(toPoint).filter((point): point is CandlePoint => point !== null);

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No candle data yet. Trades in future ticks will populate this chart.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartWidth = Math.max(760, points.length * 10);
  const chartHeight = 360;
  const leftPadding = 52;
  const rightPadding = 24;
  const topPadding = 20;
  const priceAreaHeight = 220;
  const volumeAreaTop = 260;
  const volumeAreaHeight = 78;

  const minPrice = Math.min(...points.map((point) => point.low));
  const maxPrice = Math.max(...points.map((point) => point.high));
  const priceRange = Math.max(1, maxPrice - minPrice);
  const maxVolume = Math.max(1, ...points.map((point) => point.volume));

  const plotWidth = chartWidth - leftPadding - rightPadding;
  const slot = points.length > 0 ? plotWidth / points.length : plotWidth;
  const candleBodyWidth = Math.max(2, Math.min(8, slot * 0.65));

  const priceToY = (price: number): number => {
    const normalized = (price - minPrice) / priceRange;
    return topPadding + (1 - normalized) * priceAreaHeight;
  };

  const volumeToY = (volume: number): number => {
    const normalized = volume / maxVolume;
    return volumeAreaTop + volumeAreaHeight - normalized * volumeAreaHeight;
  };

  const firstTick = points[0]?.tick ?? 0;
  const lastTick = points[points.length - 1]?.tick ?? 0;
  const midTick = points[Math.floor(points.length / 2)]?.tick ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candles + Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            width={chartWidth}
            height={chartHeight}
            role="img"
            aria-label="OHLC candles and trade volume bars"
            className="min-w-[760px] rounded-md border border-border bg-muted/15"
          >
            <line
              x1={leftPadding}
              y1={topPadding + priceAreaHeight}
              x2={chartWidth - rightPadding}
              y2={topPadding + priceAreaHeight}
              stroke="#1E2A3A"
              strokeWidth={1}
            />
            <line
              x1={leftPadding}
              y1={volumeAreaTop + volumeAreaHeight}
              x2={chartWidth - rightPadding}
              y2={volumeAreaTop + volumeAreaHeight}
              stroke="#1E2A3A"
              strokeWidth={1}
            />
            <line
              x1={leftPadding}
              y1={topPadding}
              x2={leftPadding}
              y2={volumeAreaTop + volumeAreaHeight}
              stroke="#1E2A3A"
              strokeWidth={1}
            />

            <text x={8} y={topPadding + 6} fill="#9AA7B5" fontSize={11}>
              {formatCentsRaw(maxPrice)}
            </text>
            <text x={8} y={topPadding + priceAreaHeight + 4} fill="#9AA7B5" fontSize={11}>
              {formatCentsRaw(minPrice)}
            </text>
            <text x={8} y={volumeAreaTop + 8} fill="#9AA7B5" fontSize={11}>
              Vol {maxVolume.toLocaleString()}
            </text>

            {points.map((point, index) => {
              const x = leftPadding + slot * index + slot / 2;
              const openY = priceToY(point.open);
              const closeY = priceToY(point.close);
              const highY = priceToY(point.high);
              const lowY = priceToY(point.low);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1, Math.abs(closeY - openY));
              const isBull = point.close >= point.open;
              const candleColor = isBull ? "#22C55E" : "#EF4444";
              const volumeTop = volumeToY(point.volume);

              return (
                <g key={`${point.tick}-${index}`}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={candleColor} strokeWidth={1} />
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={bodyTop}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={candleColor}
                  />
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={volumeTop}
                    width={candleBodyWidth}
                    height={volumeAreaTop + volumeAreaHeight - volumeTop}
                    fill={isBull ? "#0EA5E9" : "#38BDF8"}
                    opacity={0.7}
                  />
                </g>
              );
            })}

            <text x={leftPadding} y={chartHeight - 8} fill="#9AA7B5" fontSize={11}>
              Tick {firstTick}
            </text>
            <text
              x={leftPadding + plotWidth / 2}
              y={chartHeight - 8}
              fill="#9AA7B5"
              fontSize={11}
              textAnchor="middle"
            >
              Tick {midTick}
            </text>
            <text
              x={chartWidth - rightPadding}
              y={chartHeight - 8}
              fill="#9AA7B5"
              fontSize={11}
              textAnchor="end"
            >
              Tick {lastTick}
            </text>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
