import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body?.url || body?.channel || body?.input || "";
    const type = body?.type === "shorts" ? "shorts" : "videos";

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Missing channel URL or handle" }, { status: 400 });
    }

    const links = await fetchAllYoutubeLinks(input, type);
    return NextResponse.json(links);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch channel links" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("channel") || searchParams.get("url") || searchParams.get("input") || "";
  const typeParam = searchParams.get("type") || searchParams.get("mode") || "videos";
  const type = typeParam === "shorts" ? "shorts" : "videos";

  if (!input) {
    return NextResponse.json({ error: "Missing channel URL or handle parameter" }, { status: 400 });
  }

  try {
    const links = await fetchAllYoutubeLinks(input, type);
    return NextResponse.json(links);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch channel links" }, { status: 500 });
  }
}

async function fetchAllYoutubeLinks(input: string, mode: "videos" | "shorts" = "videos"): Promise<string[]> {
  const cleanInput = input.trim();
  if (!cleanInput) return [];

  const targetSuffix = mode === "shorts" ? "/shorts" : "/videos";
  let channelUrl = "";

  if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
    let baseUrl = cleanInput;
    if (baseUrl.includes("/shorts")) {
      baseUrl = baseUrl.replace(/\/shorts\/?.*$/, "");
    } else if (baseUrl.includes("/videos")) {
      baseUrl = baseUrl.replace(/\/videos\/?.*$/, "");
    } else {
      baseUrl = baseUrl.replace(/\/$/, "");
    }
    channelUrl = `${baseUrl}${targetSuffix}`;
  } else if (cleanInput.startsWith("@")) {
    channelUrl = `https://www.youtube.com/${cleanInput}${targetSuffix}`;
  } else if (cleanInput.startsWith("UC") && cleanInput.length === 24) {
    channelUrl = `https://www.youtube.com/channel/${cleanInput}${targetSuffix}`;
  } else {
    channelUrl = `https://www.youtube.com/@${cleanInput.replace(/^@/, "")}${targetSuffix}`;
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const videoIds = new Set<string>();

  // 1. Fetch initial channel page HTML
  let res = await fetch(channelUrl, { headers, cache: "no-store" });
  if (!res.ok) {
    const altUrl = channelUrl.replace(new RegExp(`${targetSuffix}$`), "");
    res = await fetch(altUrl, { headers, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Could not fetch channel page (HTTP ${res.status})`);
    }
  }

  const html = await res.text();
  extractVideoIdsFromText(html, videoIds);

  // Extract INNERTUBE_API_KEY
  const apiKeyMatch =
    html.match(/"INNERTUBE_API_KEY":"(AIzaSy[a-zA-Z0-9_-]{33})"/) ||
    html.match(/"apiKey":"(AIzaSy[a-zA-Z0-9_-]{33})"/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1] : "";

  // Extract initial continuation token
  let continuation = extractContinuationToken(html);

  // 2. Loop InnerTube continuation requests to fetch ALL items
  let page = 0;
  const maxPages = 300;

  while (continuation && page < maxPages) {
    page++;
    const browseUrl = apiKey
      ? `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`
      : `https://www.youtube.com/youtubei/v1/browse`;

    try {
      const browseRes = await fetch(browseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": headers["User-Agent"],
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240401.00.00",
            },
          },
          continuation: continuation,
        }),
      });

      if (!browseRes.ok) break;

      const browseData = await browseRes.json();
      const browseStr = JSON.stringify(browseData);

      const countBefore = videoIds.size;
      extractVideoIdsFromText(browseStr, videoIds);

      // Extract next continuation token
      const nextToken = extractContinuationToken(browseStr);

      if (!nextToken || nextToken === continuation) {
        break;
      }

      if (videoIds.size === countBefore && page > 3) {
        break;
      }

      continuation = nextToken;
    } catch {
      break;
    }
  }

  const linkPrefix = mode === "shorts" ? "https://www.youtube.com/shorts/" : "https://www.youtube.com/watch?v=";
  return Array.from(videoIds).map((id) => `${linkPrefix}${id}`);
}

function extractVideoIdsFromText(text: string, videoIds: Set<string>) {
  // Match "videoId":"..."
  const jsonMatches = text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
  for (const match of jsonMatches) {
    if (match[1]) videoIds.add(match[1]);
  }

  // Match /watch?v=... or /shorts/...
  const watchMatches = text.matchAll(/\/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/g);
  for (const match of watchMatches) {
    if (match[1]) videoIds.add(match[1]);
  }
}

function extractContinuationToken(text: string): string | null {
  const cmdMatch = text.match(/"continuationCommand":\s*\{\s*"token":\s*"([^"]+)"/);
  if (cmdMatch) return cmdMatch[1];

  const allTokens = Array.from(text.matchAll(/"token":"([^"]+)"/g)).map((m) => m[1]);
  const validToken = allTokens.find((t) => t.length > 25 && !t.includes("visitor") && !t.includes("session"));
  return validToken || null;
}
