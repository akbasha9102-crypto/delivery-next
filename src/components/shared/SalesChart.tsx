'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type SalesChartData = { date: string; label: string; revenue: number };

type Props = {
  data: SalesChartData[];
  dark: boolean;
};

export function SalesChart({ data, dark }: Props) {
  const t = {
    surface: dark ? '#1e293b' : '#fff',
    border:  dark ? '#334155' : '#e2e8f0',
    text:    dark ? '#f1f5f9' : '#0f172a',
    sub:     dark ? '#94a3b8' : '#64748b',
  };

  return (
    <div className="mx-4 mb-3 rounded-2xl border p-4" style={{ backgroundColor: t.surface, borderColor: t.border }}>
      <h3 className="font-bold text-right mb-4" style={{ color: t.text }}>المبيعات خلال الفترة</h3>
      {data.length <= 1 ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-sm" style={{ color: t.sub }}>اختر نطاق أوسع لعرض الرسم البياني</p>
        </div>
      ) : (
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.sub, fontSize: 11 }} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={{ fill: t.sub, fontSize: 11 }} axisLine={{ stroke: t.border }} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: t.surface, borderColor: t.border, borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: t.text, fontWeight: 'bold' }}
                itemStyle={{ color: '#22c55e' }}
                formatter={(value) => [`${Number(value).toLocaleString()} د.ع`, 'الإيراد']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
