"use client";
import React from "react";

export type Obligation = {
  periodKey: string;
  start: string;
  end: string;
  due: string;
  status: "O" | "F" | "M";
};

type Props = {
  vrn: string;
  onSelect: (o: Obligation | null) => void;
  selected?: Obligation | null;
};

export default function HmrcObligationsTable({ vrn, onSelect, selected }: Props) {
  const [items, setItems] = React.useState<Obligation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    if (!vrn) return;
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const u = new URL("/api/hmrc/obligations", window.location.origin);
      u.searchParams.set("vrn", vrn.trim());
      u.searchParams.set("status", "OPEN");
  const res = await fetch(u.toString());
const json = await res.json();
if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

const list: Obligation[] = (json.data?.obligations ?? []).map((o: any) => ({
  periodKey: o.periodKey,
  start: o.start,
  end: o.end,
  due: o.due,
  status: o.status,
}));
setItems(list);
onSelect(list[0] ?? null);
    } catch (e: any) {
      setError(e.message || String(e));
      onSelect(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    onSelect(null);
    setItems([]);
    if (vrn) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vrn]);

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Open obligations</h2>
        <button
          onClick={load}
          className="rounded-xl px-3 py-1 border hover:bg-gray-50 disabled:opacity-50"
          disabled={!vrn || loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Period</th>
              <th>Start</th>
              <th>End</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.periodKey} className="border-t">
                <td className="py-2">{o.periodKey}</td>
                <td>{o.start}</td>
                <td>{o.end}</td>
                <td>{o.due}</td>
                <td>{o.status}</td>
                <td>
                  <button
                    className={`rounded-lg px-2 py-1 border ${
                      selected?.periodKey === o.periodKey
                        ? "bg-black text-white"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => onSelect(o)}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="py-4 text-gray-500" colSpan={6}>
                  No open obligations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
