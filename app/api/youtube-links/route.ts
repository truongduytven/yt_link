import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body?.url || body?.channel || body?.input || "";
    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Missing channel URL or handle" }, { status: 400 });
    }

    const links = await fetchYoutubeLinks(input);
    return NextResponse.json(links);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch channel links" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("channel") || searchParams.get("url") || searchParams.get("input") || "";
  if (!input) {
    return NextResponse.json({ error: "Missing channel URL or handle parameter" }, { status: 400 });
  }

  try {
    const links = await fetchYoutubeLinks(input);
    return NextResponse.json(links);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch channel links" }, { status: 500 });
  }
}

async function fetchYoutubeLinks(input: string): Promise<string[]> {
  const cleanInput = input.trim();
  if (!cleanInput) return [];

  let channelUrl = "";
  if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
    channelUrl = cleanInput;
    if (!channelUrl.includes("/videos")) {
      channelUrl = channelUrl.replace(/\/$/, "") + "/videos";
    }
  } else if (cleanInput.startsWith("@")) {
    channelUrl = `https://www.youtube.com/${cleanInput}/videos`;
  } else if (cleanInput.startsWith("UC") && cleanInput.length === 24) {
    channelUrl = `https://www.youtube.com/channel/${cleanInput}/videos`;
  } else {
    channelUrl = `https://www.youtube.com/@${cleanInput.replace(/^@/, "")}/videos`;
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const videoIds = new Set<string>();

  // 1. Fetch channel page HTML
  const res = await fetch(channelUrl, { headers, cache: "no-store" });
  if (!res.ok) {
    // Retry without /videos if redirect issue
    const altUrl = channelUrl.replace(/\/videos$/, "");
    const resAlt = await fetch(altUrl, { headers, cache: "no-store" });
    if (!resAlt.ok) {
      throw new Error(`Could not fetch channel page (HTTP ${res.status})`);
    }
    const htmlAlt = await resAlt.text();
    extractVideoIdsFromHtml(htmlAlt, videoIds);
  } else {
    const html = await res.text();
    extractVideoIdsFromHtml(html, videoIds);

    // Extract Channel ID for RSS feed lookup
    const channelIdMatch =
      html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/rssUrl="https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})/);

    if (channelIdMatch && channelIdMatch[1]) {
      const channelId = channelIdMatch[1];
      try {
        const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
          headers,
          cache: "no-store",
        });
        if (rssRes.ok) {
          const rssText = await rssRes.text();
          const rssMatches = rssText.matchAll(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/g);
          for (const m of rssMatches) {
            if (m[1]) videoIds.add(m[1]);
          }
        }
      } catch {
        // RSS fetch fallback silent
      }
    }
  }

  // Map to full video URLs
  return Array.from(videoIds).map((id) => `https://www.youtube.com/watch?v=${id}`);
}

function extractVideoIdsFromHtml(html: string, videoIds: Set<string>) {
  // Match videoId in JSON payload (ytInitialData)
  const jsonMatches = html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
  for (const match of jsonMatches) {
    if (match[1]) videoIds.add(match[1]);
  }

  // Match watch links in HTML
  const linkMatches = html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g);
  for (const match of linkMatches) {
    if (match[1]) videoIds.add(match[1]);
  }
}
