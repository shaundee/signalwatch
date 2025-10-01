"use client";

type Props = {
  domainId: string;
  token: string;
  verifiedAt?: string | null;
};

export default function DomainVerify({ domainId, token, verifiedAt }: Props) {
  const verified = !!verifiedAt;

  async function recheck() {
    const r = await fetch("/api/domains/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domainId }),
    });
    const j = await r.json();
    if (j?.verified) window.location.reload();
  }

  return (
    <div className="rounded-xl border p-3 mt-3 text-sm">
      {verified ? (
        <div className="text-emerald-700">✅ Domain verified</div>
      ) : (
        <>
          <div className="font-medium mb-1">Verify ownership</div>
          <ol className="list-decimal ml-5 space-y-1">
            <li>
              Add to your homepage:
              <br />
              <code className="break-all">
                {`<meta name="signalwatch-verify" content="${token}" />`}
              </code>
            </li>
            <li>
              or create <code>/.well-known/signalwatch.txt</code> containing exactly:
              <br />
              <code className="break-all">{token}</code>
            </li>
          </ol>
          <button onClick={recheck} className="mt-3 rounded-lg border px-3 py-1">
            Re-check
          </button>
        </>
      )}
    </div>
  );
}
