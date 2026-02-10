"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Pagination, usePagination, CopyButton } from "@ssot/ui";
import { useBets } from "../../features/bets/useBets";
import { useIndexer } from "../../features/ops/useIndexer";

function shortHex(s?: string) {
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function BetsPage() {
  const { data: bets = [], isLoading } = useBets(500);
  const { indexerStatus, syncNow } = useIndexer();
  const { page, pageCount, setPage, startIndex, endIndex } = usePagination({ totalItems: bets.length, pageSize: 20 });
  const visibleBets = bets.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bets</CardTitle>
          <CardDescription>
            Hub events as facts, stored locally (Dexie) and reduced into a derived bet lifecycle table.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            lastSyncedBlock: <span className="font-mono text-foreground">{indexerStatus?.lastSyncedBlock ?? "—"}</span>
            {"  "}
            latest: <span className="font-mono text-foreground">{indexerStatus?.latestBlock ?? "—"}</span>
          </div>
          <Button variant="secondary" onClick={() => void syncNow()}>
            Sync now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
          <CardDescription>{isLoading ? "Loading…" : `${bets.length} rows`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">betId</th>
                  <th className="py-2 pr-3">state</th>
                  <th className="py-2 pr-3">updatedBlock</th>
                  <th className="py-2 pr-3">asset</th>
                  <th className="py-2 pr-3">player</th>
                  <th className="py-2 pr-3">tx</th>
                  <th className="py-2">event</th>
                </tr>
              </thead>
              <tbody>
                {visibleBets.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{b.betId}</td>
                    <td className="py-2 pr-3">{b.state}</td>
                    <td className="py-2 pr-3 font-mono">{b.updatedBlock}</td>
                    <td className="py-2 pr-3 font-mono">
                      <span className="inline-flex items-center gap-1">
                        {shortHex(b.asset)}
                        {b.asset && <CopyButton value={b.asset} label="Copy asset address" />}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      <span className="inline-flex items-center gap-1">
                        {shortHex(b.player)}
                        {b.player && <CopyButton value={b.player} label="Copy player address" />}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      <span className="inline-flex items-center gap-1">
                        {shortHex(b.lastTxHash)}
                        {b.lastTxHash && <CopyButton value={b.lastTxHash} label="Copy transaction hash" />}
                      </span>
                    </td>
                    <td className="py-2">{b.lastEventName}</td>
                  </tr>
                ))}
                {bets.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={7}>
                      No bets indexed yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}
