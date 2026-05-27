import { cn } from '@/lib/cn';

export default function DataTable({ columns, rows, rowKey = 'id', empty, loading, onRowClick }) {
  if (loading) {
    return <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center text-sm text-ink-500">Loading…</div>;
  }
  if (!rows || rows.length === 0) {
    return empty || (
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center text-sm text-ink-500">
        No data yet.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-200 text-sm">
          <thead className="bg-ink-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500',
                  c.align === 'right' && 'text-right',
                  c.className
                )}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {rows.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && 'cursor-pointer hover:bg-ink-50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn(
                    'px-4 py-3 text-ink-800',
                    c.align === 'right' && 'text-right',
                    c.className
                  )}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
