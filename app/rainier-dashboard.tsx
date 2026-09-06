'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Aperture,
  ArrowUpRight,
  Camera,
  CloudSun,
  RefreshCw,
  RotateCcw,
  Satellite,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Verdict = 'likely' | 'maybe' | 'not';
type LiveData = {
  checkedAt: string;
  tacoma: {
    embedUrl: string | null;
    ageLabel: string | null;
    error: string | null;
    sourceUrl: string;
  };
  seattle: {
    imageUrl: string | null;
    capturedLabel: string | null;
    error: string | null;
    sourceUrl: string;
  };
  weather: {
    score: number | null;
    verdict: Verdict;
    label: string;
    summary: string;
    avgLowCloud: number | null;
    avgVisibilityMiles: number | null;
  };
};

type ModelContextDocument = Document & {
  modelContext?: {
    registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
  };
};

const REFRESH_SECONDS = 300;

function SourceFallback({ href, name }: { href: string; name: string }) {
  return (
    <div className="media-fallback" role="status">
      <Camera size={25} />
      <strong>Live view did not load</strong>
      <span>The source may be offline or blocking this browser.</span>
      <a className="source-button" href={href} target="_blank" rel="noreferrer">
        Open {name} <ArrowUpRight size={14} />
      </a>
    </div>
  );
}

function TacomaFrame({ data }: { data: LiveData['tacoma'] }) {
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setReady(false);
    setTimedOut(false);
    if (!data.embedUrl) return;
    const timeout = window.setTimeout(() => setTimedOut(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [data.embedUrl]);

  if (!data.embedUrl || timedOut) return <SourceFallback href={data.sourceUrl} name="Windy webcam" />;

  return (
    <>
      {!ready && (
        <div className="media-loading" role="status">
          <Satellite size={24} />
          <span>Connecting to Windy live player…</span>
        </div>
      )}
      <iframe
        className={`live-embed ${ready ? 'is-ready' : ''}`}
        src={data.embedUrl}
        title="Tacoma southeast webcam live player"
        loading="eager"
        allow="autoplay; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setReady(true)}
        onError={() => setTimedOut(true)}
      />
    </>
  );
}

function SeattleFrame({ data }: { data: LiveData['seattle'] }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [data.imageUrl]);

  if (!data.imageUrl || failed) return <SourceFallback href={data.sourceUrl} name="Seattle source" />;

  return (
    <img
      className="seattle-image"
      src={data.imageUrl}
      alt="Current south-southeast view toward Mount Rainier from the Space Needle Panocam"
      onError={() => setFailed(true)}
    />
  );
}

export default function RainierDashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/live', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
      const nextData = (await response.json()) as LiveData;
      setData(nextData);
      setSecondsLeft(REFRESH_SECONDS);
      return nextData;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live sources are unavailable');
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData().catch(() => undefined);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          void loadData().catch(() => undefined);
          return REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const context = (document as ModelContextDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'refresh_rainier_conditions',
            title: 'Refresh Rainier conditions',
            description: 'Refresh both Rainier camera sources and the current Seattle–Tacoma weather visibility signal.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async () => {
              const refreshed = await loadData();
              return {
                verdict: refreshed.weather.label,
                score: refreshed.weather.score,
                checkedAt: refreshed.checkedAt,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // WebMCP is optional and not supported in every browser.
    }
    return () => lifecycle.abort();
  }, [loadData]);

  const refreshedAt = useMemo(() => {
    if (!data?.checkedAt) return 'Not yet checked';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(data.checkedAt));
  }, [data?.checkedAt]);

  const verdict = data?.weather.verdict ?? 'maybe';
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Rainier Watch home">
          <span className="brand-mark"><Aperture size={17} /></span>
          <span>Rainier Watch</span>
        </a>
        <div className="refresh-tools">
          <span className="refresh-clock">Auto refresh {minutes}:{seconds}</span>
          <Button
            className="refresh-button"
            variant="outline"
            size="sm"
            onClick={() => void loadData().catch(() => undefined)}
            disabled={loading}
            aria-label="Refresh camera and weather sources now"
          >
            <RefreshCw className={loading ? 'spin' : ''} />
            {loading ? 'Refreshing' : 'Refresh now'}
          </Button>
        </div>
      </header>

      <section className="decision-strip" id="top">
        <div>
          <p className="eyebrow">PHOTO WINDOW · PUGET SOUND</p>
          <h1>Is the mountain worth the shot?</h1>
        </div>
        <div className={`decision-card decision-${verdict}`} aria-live="polite">
          <span className="status-dot" />
          <div>
            <p className="status-label">{data?.weather.label ?? 'Checking conditions'}</p>
            <p className="status-note">
              {error ? 'Weather signal unavailable — use the camera views.' : data?.weather.summary ?? 'Connecting to current cameras and weather…'}
            </p>
          </div>
          {data?.weather.score !== null && data?.weather.score !== undefined && (
            <span className="score" title="Weather-only visibility score">{data.weather.score}</span>
          )}
        </div>
      </section>

      <section className="camera-grid" aria-label="Mount Rainier camera views">
        <article className="camera-card">
          <div className="camera-frame">
            {data ? <TacomaFrame data={data.tacoma} /> : <div className="media-loading"><Satellite size={24} /><span>Connecting…</span></div>}
            <span className="live-chip">LIVE PLAYER</span>
          </div>
          <div className="camera-meta">
            <div>
              <p className="camera-kicker">TACOMA · 47.254° N</p>
              <h2>Dome District</h2>
              <p>Looking southeast · toward Mount Rainier</p>
            </div>
            <a href={data?.tacoma.sourceUrl ?? 'https://www.windy.com/webcams/1707679927'} target="_blank" rel="noreferrer" aria-label="Open Tacoma webcam source">
              <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="source-row">
            <span>{data?.tacoma.ageLabel ? `Frame ${data.tacoma.ageLabel}` : 'Current Windy player'}</span>
            <a href="https://www.windy.com/" target="_blank" rel="noreferrer">Webcam provided by Windy.com</a>
          </div>
        </article>

        <article className="camera-card">
          <div className="camera-frame">
            {data ? <SeattleFrame data={data.seattle} /> : <div className="media-loading"><CloudSun size={24} /><span>Finding today’s image…</span></div>}
            <span className="live-chip">10 MIN FRAME</span>
          </div>
          <div className="camera-meta">
            <div>
              <p className="camera-kicker">SEATTLE · SPACE NEEDLE</p>
              <h2>City to summit</h2>
              <p>Looking south-southeast · Rainier on the horizon</p>
            </div>
            <a href={data?.seattle.sourceUrl ?? 'https://ismtrainierout.com/'} target="_blank" rel="noreferrer" aria-label="Open Seattle Rainier source">
              <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="source-row">
            <span>{data?.seattle.capturedLabel ? `Captured ${data.seattle.capturedLabel}` : 'Latest available frame'}</span>
            <a href="https://ismtrainierout.com/" target="_blank" rel="noreferrer">Is Mt Rainier Out? · image via Space Needle Panocam</a>
          </div>
        </article>
      </section>

      <section className="utility-strip" aria-label="How to read this dashboard">
        <div>
          <p className="utility-label">WEATHER SIGNAL</p>
          <p>Uses modeled low/mid/high cloud, precipitation, and horizontal visibility in Seattle and Tacoma. It does not visually recognize Rainier.</p>
        </div>
        <div>
          <p className="utility-label">LAST CHECK</p>
          <p>{refreshedAt} local · camera frames may be several minutes older</p>
        </div>
        <Button className="retry-button" variant="ghost" size="sm" onClick={() => void loadData().catch(() => undefined)}>
          <RotateCcw /> Try sources again
        </Button>
      </section>

      <footer id="sources">
        <p>Two city angles. One quick decision.</p>
        <p>
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> · adapted into a local photo-planning signal under CC BY 4.0.
        </p>
      </footer>
    </main>
  );
}
