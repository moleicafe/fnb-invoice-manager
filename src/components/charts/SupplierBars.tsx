'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function SupplierBars({ data }: { data: { name: string; total: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={140}
            tickFormatter={(v) => String(v).slice(0, 18)}
          />
          <Tooltip formatter={(v) => Number(v).toFixed(2)} cursor={{ fill: 'rgba(0,82,255,0.04)' }} />
          <Bar dataKey="total" fill="#0052ff" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
