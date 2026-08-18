import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body?.url || body?.channel || body?.video || body?.input || "";

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Missing channel or video URL" }, { status: 400 });
    }

    const data = await processYoutubeInput(input);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process YouTube request" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("url") || searchParams.get("channel") || searchParams.get("video") || searchParams.get("input") || "";

  if (!input) {
    return NextResponse.json({ error: "Missing url, channel, or video parameter" }, { status: 400 });
  }

  try {
    const data = await processYoutubeInput(input);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process YouTube request" }, { status: 500 });
  }
}

interface YoutubeResult {
  channel: string;
  channelUrl: string;
  videos: string[];
  shorts: string[];
}

async function processYoutubeInput(input: string): Promise<YoutubeResult> {
  const cleanInput = input.trim();
  if (!cleanInput) {
    throw new Error("Input string is empty");
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  let handleOrChannelId = "";
  let extractedFromVideo = false;

  // 1. Check if input is a Video URL (watch?v=, shorts/, or youtu.be/)
  const videoMatch =
    cleanInput.match(/(?:watch\?v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
    cleanInput.match(/^([a-zA-Z0-9_-]{11})$/);

  if (videoMatch && (cleanInput.includes("youtube.com") || cleanInput.includes("youtu.be") || cleanInput.startsWith("http"))) {
    const videoId = videoMatch[1];
    extractedFromVideo = true;
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoRes = await fetch(videoPageUrl, { headers, cache: "no-store" });

    if (!videoRes.ok) {
      throw new Error(`Could not fetch video details from URL (HTTP ${videoRes.status})`);
    }

    const videoHtml = await videoRes.text();
    const handleMatch =
      videoHtml.match(/"canonicalBaseUrl":"(\/@[^"]+)"/) ||
      videoHtml.match(/"ownerUrl":"(https:\/\/www\.youtube\.com\/@[^"]+)"/);

    const channelIdMatch =
      videoHtml.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      videoHtml.match(/"externalChannelId":"(UC[a-zA-Z0-9_-]{22})"/);

    if (handleMatch && handleMatch[1]) {
      handleOrChannelId = handleMatch[1].replace(/^\//, "");
    } else if (channelIdMatch && channelIdMatch[1]) {
      handleOrChannelId = `channel/${channelIdMatch[1]}`;
    } else {
      throw new Error("Could not detect channel owner from video link");
    }
  } else {
    // Input is Channel handle or channel URL
    if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
      let baseUrl = cleanInput.replace(/\/videos\/?.*$/, "").replace(/\/shorts\/?.*$/, "").replace(/\/$/, "");
      const matchHandle = baseUrl.match(/youtube\.com\/(@[^\/]+)/);
      const matchChannel = baseUrl.match(/youtube\.com\/(channel\/UC[a-zA-Z0-9_-]{22})/);

      if (matchHandle) {
        handleOrChannelId = matchHandle[1];
      } else if (matchChannel) {
        handleOrChannelId = matchChannel[1];
      } else {
        handleOrChannelId = baseUrl.split("/").pop() || "";
        if (!handleOrChannelId.startsWith("@") && !handleOrChannelId.startsWith("channel/")) {
          handleOrChannelId = `@${handleOrChannelId}`;
        }
      }
    } else if (cleanInput.startsWith("@")) {
      handleOrChannelId = cleanInput;
    } else if (cleanInput.startsWith("UC") && cleanInput.length === 24) {
      handleOrChannelId = `channel/${cleanInput}`;
    } else {
      handleOrChannelId = `@${cleanInput.replace(/^@/, "")}`;
    }
  }

  const baseChannelUrl = `https://www.youtube.com/${handleOrChannelId.replace(/^\//, "")}`;

  // Fetch Videos & Shorts in parallel
  const [videos, shorts] = await Promise.all([
    fetchTabLinks(baseChannelUrl, "videos", headers),
    fetchTabLinks(baseChannelUrl, "shorts", headers),
  ]);

  return {
    channel: handleOrChannelId.startsWith("@") ? handleOrChannelId : `@${handleOrChannelId}`,
    channelUrl: baseChannelUrl,
    videos,
    shorts,
  };
}

async function fetchTabLinks(baseChannelUrl: string, mode: "videos" | "shorts", headers: Record<string, string>): Promise<string[]> {
  const targetUrl = `${baseChannelUrl}/${mode}`;
  const videoIds = new Set<string>();

  let res = await fetch(targetUrl, { headers, cache: "no-store" });
  if (!res.ok) {
    const altUrl = baseChannelUrl;
    res = await fetch(altUrl, { headers, cache: "no-store" });
    if (!res.ok) return [];
  }

  const html = await res.text();
  extractVideoIdsFromText(html, videoIds);

  const apiKeyMatch =
    html.match(/"INNERTUBE_API_KEY":"(AIzaSy[a-zA-Z0-9_-]{33})"/) ||
    html.match(/"apiKey":"(AIzaSy[a-zA-Z0-9_-]{33})"/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1] : "";

  let continuation = extractContinuationToken(html);
  let page = 0;
  const maxPages = 200;

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

      const nextToken = extractContinuationToken(browseStr);
      if (!nextToken || nextToken === continuation) break;

      if (videoIds.size === countBefore && page > 3) break;

      continuation = nextToken;
    } catch {
      break;
    }
  }

  const linkPrefix = mode === "shorts" ? "https://www.youtube.com/shorts/" : "https://www.youtube.com/watch?v=";
  return Array.from(videoIds).map((id) => `${linkPrefix}${id}`);
}

function extractVideoIdsFromText(text: string, videoIds: Set<string>) {
  const jsonMatches = text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
  for (const match of jsonMatches) {
    if (match[1]) videoIds.add(match[1]);
  }

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
