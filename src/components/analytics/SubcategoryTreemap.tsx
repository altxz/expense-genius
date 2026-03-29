import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';

interface Props {
  expenses: any[];
  categories: any[];
}

const FALLBACK_COLORS = ['#6366f1','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

export function SubcategoryTreemap({ expenses, categories }: Props) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      map[e.final_category] = (map[e.final_category] || 0) + e.value;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, total], i) => {
        const dbCat = categories.find((c: any) => c.name.toLowerCase() === cat);
        return {
          name: dbCat?.name || cat,
          value: total,
          fill: dbCat?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        };
      });
  }, [expenses, categories]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Subcategorias Detalhadas</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Subcategorias Detalhadas</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius="40%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
