import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DailyActivityPoint = {
  date: string;
  shortLabel: string;
  reviews: number;
};

type TimeSpentPoint = {
  date: string;
  shortLabel: string;
  minutes: number;
};

type CardStatePoint = {
  label: string;
  value: number;
  percentage: number;
  fill: string;
};

type RatingPoint = {
  label: string;
  count: number;
  percentage: number;
  fill: string;
};

type DueForecastPoint = {
  date: string;
  shortLabel: string;
  count: number;
};

type EaseBucketPoint = {
  bucket: string;
  count: number;
};

interface DailyActivityChartProps {
  data: DailyActivityPoint[];
  reviewsLabel: string;
}

interface TimeSpentChartProps {
  data: TimeSpentPoint[];
  minutesLabel: string;
}

interface CardStatesChartProps {
  data: CardStatePoint[];
  totalLabel: string;
  totalValue: number;
  cardsLabel: string;
}

interface RatingsChartProps {
  data: RatingPoint[];
  ratingsLabel: string;
}

interface DueForecastChartProps {
  countLabel: string;
  data: DueForecastPoint[];
}

interface EaseSpreadChartProps {
  countLabel: string;
  data: EaseBucketPoint[];
}

function formatTooltipNumber(value: number | string | readonly (number | string)[] | undefined): string {
  if (typeof value === 'undefined') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatTooltipNumber(entry)).join(', ');
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

function getXAxisInterval(length: number) {
  if (length <= 8) return 0;
  return Math.max(0, Math.ceil(length / 8) - 1);
}

export function DeckDailyActivityChart(props: Readonly<DailyActivityChartProps>) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="shortLabel"
            interval={getXAxisInterval(props.data.length)}
            tickLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs"
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={36}
            className="fill-muted-foreground text-xs"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 12,
            }}
            formatter={(value) => [formatTooltipNumber(value), props.reviewsLabel]}
            labelFormatter={(label, payload) => {
              const point = payload[0]?.payload;
              if (typeof point?.date === 'string') {
                return point.date;
              }
              return label;
            }}
          />
          <Bar activeBar={{ fill: 'hsl(var(--primary))', opacity: 0.85 }} dataKey="reviews" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeckTimeSpentChart(props: Readonly<TimeSpentChartProps>) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="shortLabel"
            interval={getXAxisInterval(props.data.length)}
            tickLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs"
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={36}
            className="fill-muted-foreground text-xs"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 12,
            }}
            formatter={(value) => [
              typeof value === 'number' ? `${Math.round(value)} ${props.minutesLabel}` : value,
              props.minutesLabel,
            ]}
            labelFormatter={(label, payload) => {
              const point = payload[0]?.payload;
              if (typeof point?.date === 'string') {
                return point.date;
              }
              return label;
            }}
          />
          <Bar activeBar={{ fill: '#14b8a6', opacity: 0.85 }} dataKey="minutes" fill="#14b8a6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeckCardStatesChart(props: Readonly<CardStatesChartProps>) {
  const hasValues = props.data.some((item) => item.value > 0);

  if (!hasValues) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-center">
      <div className="relative mx-auto h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 12,
              }}
              formatter={(value) => [formatTooltipNumber(value), props.cardsLabel]}
            />
            <Pie
              data={props.data}
              dataKey="value"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {props.data.map((item) => (
                <Cell key={item.label} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold">{props.totalValue.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">{props.totalLabel}</span>
        </div>
      </div>

      <div className="space-y-3">
        {props.data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                <span>{item.label}</span>
              </div>
              <span className="font-medium">
                {item.value.toLocaleString()} ({item.percentage}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ backgroundColor: item.fill, width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeckRatingsChart(props: Readonly<RatingsChartProps>) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
          <XAxis allowDecimals={false} axisLine={false} tickLine={false} type="number" className="fill-muted-foreground text-xs" />
          <YAxis
            axisLine={false}
            dataKey="label"
            tickLine={false}
            tickMargin={10}
            type="category"
            width={56}
            className="fill-muted-foreground text-xs"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 12,
            }}
            formatter={(value, _name, item) => {
              const percentage = typeof item.payload?.percentage === 'number' ? item.payload.percentage : 0;
              return [`${formatTooltipNumber(value)} (${percentage}%)`, props.ratingsLabel];
            }}
          />
          <Bar activeBar={{ opacity: 0.85 }} dataKey="count" radius={[0, 6, 6, 0]}>
            {props.data.map((item) => (
              <Cell key={item.label} fill={item.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeckDueForecastChart(props: Readonly<DueForecastChartProps>) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="shortLabel"
            interval={getXAxisInterval(props.data.length)}
            tickLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs"
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={36}
            className="fill-muted-foreground text-xs"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 12,
            }}
            formatter={(value) => [formatTooltipNumber(value), props.countLabel]}
            labelFormatter={(label, payload) => {
              const point = payload[0]?.payload;
              if (typeof point?.date === 'string') {
                return point.date;
              }
              return label;
            }}
          />
          <Bar activeBar={{ fill: '#6366f1', opacity: 0.85 }} dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeckEaseSpreadChart(props: Readonly<EaseSpreadChartProps>) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
          <XAxis allowDecimals={false} axisLine={false} tickLine={false} type="number" className="fill-muted-foreground text-xs" />
          <YAxis
            axisLine={false}
            dataKey="bucket"
            tickLine={false}
            tickMargin={10}
            type="category"
            width={72}
            className="fill-muted-foreground text-xs"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 12,
            }}
            formatter={(value) => [formatTooltipNumber(value), props.countLabel]}
          />
          <Bar activeBar={{ fill: '#8b5cf6', opacity: 0.85 }} dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
