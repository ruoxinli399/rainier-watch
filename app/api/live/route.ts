export const dynamic = 'force-dynamic';

const TACOMA_CAMERA_ID = '1707679927';
const TACOMA_LISTING =
  'https://www.meteoblue.com/en/weather/webcams/city-of-tacoma_united-states_7174537';
const TACOMA_SOURCE = `https://www.windy.com/webcams/${TACOMA_CAMERA_ID}`;
const SEATTLE_SOURCE = 'https://ismtrainierout.com/';

type WeatherCurrent = {
  time: string;
  visibility: number;
  cloud_cover: number;
  cloud_cover_low: number;
  cloud_cover_mid: number;
  cloud_cover_high: number;
  precipitation: number;
  is_day: number;
};

type LocationWeather = {
  name: string;
  current: WeatherCurrent;
};

function unescapeHtml(value: string) {
  return value.replaceAll('&amp;', '&').replaceAll('&#x2F;', '/');
}

function scoreWeather(locations: LocationWeather[]) {
  const locationScores = locations.map(({ current }) => {
    const weightedCloud =
      current.cloud_cover_low * 0.58 +
      current.cloud_cover_mid * 0.3 +
      current.cloud_cover_high * 0.12;
    const cloudClarity = 100 - weightedCloud;
    const distanceClarity = Math.min(100, (current.visibility / 35_000) * 100);
    const rainPenalty = Math.min(32, current.precipitation * 40);
    return Math.max(0, Math.min(100, cloudClarity * 0.62 + distanceClarity * 0.38 - rainPenalty));
  });

  const score = Math.round(locationScores.reduce((sum, value) => sum + value, 0) / locationScores.length);
  const avgLowCloud = Math.round(
    locations.reduce((sum, item) => sum + item.current.cloud_cover_low, 0) / locations.length,
  );
  const avgVisibilityMiles = Math.round(
    (locations.reduce((sum, item) => sum + item.current.visibility, 0) / locations.length / 1609.344) * 10,
  ) / 10;
  const isNight = locations.every((item) => item.current.is_day === 0);

  if (isNight) {
    return {
      score,
      verdict: 'maybe' as const,
      label: 'Maybe — cameras are dark',
      summary: 'The weather signal is available, but the city cameras need daylight for a useful call.',
      avgLowCloud,
      avgVisibilityMiles,
    };
  }

  const verdict = score >= 68 ? 'likely' : score >= 38 ? 'maybe' : 'not';
  const label =
    verdict === 'likely'
      ? 'Rainier likely visible'
      : verdict === 'maybe'
        ? 'Maybe — check both views'
        : 'Rainier likely not visible';

  return {
    score,
    verdict,
    label,
    summary: `${avgLowCloud}% low cloud · ${avgVisibilityMiles} mi modeled visibility across Seattle and Tacoma.`,
    avgLowCloud,
    avgVisibilityMiles,
  };
}

async function getTacomaSource() {
  try {
    const response = await fetch(TACOMA_LISTING, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Rainier-Watch/1.0 (+local photo planning dashboard)' },
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const html = await response.text();
    const match = html.match(
      new RegExp(`data-embed="(https://webcams\\.windy\\.com/webcams/public/embed/player/${TACOMA_CAMERA_ID}/day\\?[^"]+)"`),
    );
    if (!match) throw new Error('Current Windy embed was not found');
    const ageMatch = html.match(
      /Tacoma › South-east: LeMay - America’s Car Museum - Tacoma Dome[\s\S]{0,220}?(\d+\s+(?:minute|minutes|hour|hours)\s+ago)/i,
    );
    return { embedUrl: unescapeHtml(match[1]), ageLabel: ageMatch?.[1] ?? null, error: null };
  } catch (error) {
    return {
      embedUrl: null,
      ageLabel: null,
      error: error instanceof Error ? error.message : 'Tacoma source unavailable',
    };
  }
}

async function getSeattleSource() {
  try {
    const response = await fetch(SEATTLE_SOURCE, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Rainier-Watch/1.0 (+local photo planning dashboard)' },
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const html = await response.text();
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (!imageMatch) throw new Error('Current Seattle image was not found');
    const imageUrl = unescapeHtml(imageMatch[1]);
    const timestampMatch = imageUrl.match(/\/(\d{4})_(\d{2})_(\d{2})\/(\d{2})(\d{2})\.jpg/);
    let capturedLabel: string | null = null;
    if (timestampMatch) {
      const [, , month, day, hour, minute] = timestampMatch;
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1];
      const hourNumber = Number(hour);
      const displayHour = hourNumber % 12 || 12;
      capturedLabel = `${monthName} ${Number(day)}, ${displayHour}:${minute} ${hourNumber >= 12 ? 'PM' : 'AM'}`;
    }
    return { imageUrl, capturedLabel, error: null };
  } catch (error) {
    return {
      imageUrl: null,
      capturedLabel: null,
      error: error instanceof Error ? error.message : 'Seattle source unavailable',
    };
  }
}

async function getWeather() {
  const locations = [
    { name: 'Seattle', latitude: 47.6062, longitude: -122.3321 },
    { name: 'Tacoma', latitude: 47.2529, longitude: -122.4443 },
  ];
  const current = [
    'visibility',
    'cloud_cover',
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
    'precipitation',
    'is_day',
  ].join(',');

  const readings = await Promise.all(
    locations.map(async (location) => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(location.latitude));
      url.searchParams.set('longitude', String(location.longitude));
      url.searchParams.set('current', current);
      url.searchParams.set('timezone', 'America/Los_Angeles');
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Weather source returned ${response.status}`);
      const data = (await response.json()) as { current: WeatherCurrent };
      return { name: location.name, current: data.current };
    }),
  );

  return { ...scoreWeather(readings), locations: readings };
}

export async function GET() {
  const [tacoma, seattle, weatherResult] = await Promise.allSettled([
    getTacomaSource(),
    getSeattleSource(),
    getWeather(),
  ]);

  const weather =
    weatherResult.status === 'fulfilled'
      ? weatherResult.value
      : {
          score: null,
          verdict: 'maybe' as const,
          label: 'Check the camera views',
          summary: 'Weather metadata is temporarily unavailable.',
          avgLowCloud: null,
          avgVisibilityMiles: null,
          locations: [],
        };

  return Response.json(
    {
      checkedAt: new Date().toISOString(),
      tacoma:
        tacoma.status === 'fulfilled'
          ? { ...tacoma.value, sourceUrl: TACOMA_SOURCE }
          : { embedUrl: null, ageLabel: null, error: 'Tacoma source unavailable', sourceUrl: TACOMA_SOURCE },
      seattle:
        seattle.status === 'fulfilled'
          ? { ...seattle.value, sourceUrl: SEATTLE_SOURCE }
          : { imageUrl: null, capturedLabel: null, error: 'Seattle source unavailable', sourceUrl: SEATTLE_SOURCE },
      weather,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
