"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip);

const VIOLET = "#4C3FD7";
const PINK = "#FF6B9D";
const PINK_TINT = "#FFE7EF";

export function TopSellersBar({
  data,
  money,
}: {
  data: { name: string; revenue: number }[];
  money: (n: number) => string;
}) {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.name),
        datasets: [
          {
            data: data.map((d) => d.revenue),
            backgroundColor: VIOLET,
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      }}
      options={{
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: (v) => money(Number(v)) } } },
      }}
    />
  );
}

export function CumulativeLine({
  data,
  money,
}: {
  data: { index: number; cumulative: number }[];
  money: (n: number) => string;
}) {
  return (
    <Line
      data={{
        labels: data.map((d) => `Sale ${d.index}`),
        datasets: [
          {
            data: data.map((d) => d.cumulative),
            borderColor: PINK,
            backgroundColor: PINK_TINT,
            fill: true,
            tension: 0.3,
            pointRadius: 2,
          },
        ],
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => money(Number(v)) } } },
      }}
    />
  );
}
