"use client";

import { useEffect, useState } from "react";
import s from "./page.module.css";

type BlocklistRow = { number: string; label: string };
type Voicemail = {
  id: number;
  fromNumber: string;
  transcript: string;
  source: string;
  matchedKeywords: string[];
  blocked: boolean;
  ingestedAt: string;
};

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [blocklist, setBlocklist] = useState<BlocklistRow[]>([]);
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("Spam");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("spamshield.apiKey");
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("spamshield.apiKey", apiKey);
    if (apiKey.length >= 16) {
      void refresh(apiKey);
    }
  }, [apiKey]);

  async function refresh(key: string) {
    setStatus("Loading…");
    try {
      const [bl, vm] = await Promise.all([
        fetch("/api/blocklist", {
          headers: { authorization: `Bearer ${key}` },
        }),
        fetch("/api/voicemails", {
          headers: { authorization: `Bearer ${key}` },
        }),
      ]);
      if (!bl.ok || !vm.ok) {
        setStatus(
          bl.status === 401 || vm.status === 401
            ? "Wrong API key"
            : `Error: ${bl.status} / ${vm.status}`,
        );
        return;
      }
      const blData = (await bl.json()) as { numbers: BlocklistRow[] };
      const vmData = (await vm.json()) as { voicemails: Voicemail[] };
      setBlocklist(blData.numbers);
      setVoicemails(vmData.voicemails);
      setStatus(null);
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    }
  }

  async function addNumber() {
    if (!newNumber.trim()) return;
    const res = await fetch("/api/blocklist", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ number: newNumber, label: newLabel }),
    });
    if (res.ok) {
      setNewNumber("");
      void refresh(apiKey);
    } else {
      setStatus(`Add failed: ${res.status}`);
    }
  }

  async function removeNumber(n: string) {
    const res = await fetch(`/api/blocklist/${encodeURIComponent(n)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) void refresh(apiKey);
  }

  return (
    <main className={s.shell}>
      <h1 className={s.h1}>SpamShield</h1>
      <p className={s.sub}>
        Blocklist + voicemail classifier. iOS Call Directory Extension polls{" "}
        <code>/api/blocklist</code>; voicemail webhook posts to{" "}
        <code>/api/ingest</code>.
      </p>

      <input
        className={s.keyInput}
        type="password"
        placeholder="Paste API_KEY"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <section className={s.section}>
        <h2 className={s.sectionH}>
          Blocklist ({blocklist.length})
          {status ? <span className={s.status}>{status}</span> : null}
        </h2>
        <div className={s.row} style={{ marginBottom: 12 }}>
          <input
            placeholder="+1 (801) 555-1234"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
          />
          <input
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <button className={s.btn} onClick={addNumber}>
            Add
          </button>
        </div>
        {blocklist.length === 0 ? (
          <p className={s.empty}>No numbers blocked yet.</p>
        ) : (
          <ul className={s.list}>
            {blocklist.map((b) => (
              <li key={b.number} className={s.item}>
                <div className={s.itemMain}>
                  <span className={s.itemNumber}>+{b.number}</span>
                  <span className={s.itemLabel}>{b.label}</span>
                </div>
                <button
                  className={s.btnDanger}
                  onClick={() => removeNumber(b.number)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.section}>
        <h2 className={s.sectionH}>
          Recent voicemails ({voicemails.length})
        </h2>
        {voicemails.length === 0 ? (
          <p className={s.empty}>
            Nothing ingested yet. POST to <code>/api/ingest</code>.
          </p>
        ) : (
          <ul className={s.list}>
            {voicemails.map((v) => (
              <li key={v.id} className={s.item} style={{ display: "block" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span className={s.itemNumber}>+{v.fromNumber}</span>
                  <span className={s.itemLabel}>
                    {new Date(v.ingestedAt).toLocaleString()}
                    {v.blocked ? " · blocked" : ""}
                  </span>
                </div>
                {v.matchedKeywords.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {v.matchedKeywords.map((k) => (
                      <span key={k} className={s.tag}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                <p className={s.transcript}>{v.transcript}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
