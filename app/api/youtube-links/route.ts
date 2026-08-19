import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body?.url || body?.channel || body?.video || body?.input || "";
    const platform = body?.platform || body?.mode || "auto";

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Missing channel or video URL" }, { status: 400 });
    }

    const data = await processSocialInput(input, platform);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("url") || searchParams.get("channel") || searchParams.get("video") || searchParams.get("input") || "";
  const platform = searchParams.get("platform") || searchParams.get("mode") || "auto";

  if (!input) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const data = await processSocialInput(input, platform);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}

export interface SocialResult {
  platform: "youtube" | "tiktok" | "facebook" | "instagram";
  channel: string;
  channelUrl: string;
  videos: string[];
  shorts: string[];
}

async function processSocialInput(input: string, platformHint: string): Promise<SocialResult> {
  const cleanInput = input.trim();
  if (!cleanInput) throw new Error("Input string is empty");

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  let platform = platformHint;
  if (platform === "auto") {
    if (cleanInput.includes("tiktok.com")) platform = "tiktok";
    else if (cleanInput.includes("facebook.com") || cleanInput.includes("fb.watch")) platform = "facebook";
    else if (cleanInput.includes("instagram.com")) platform = "instagram";
    else platform = "youtube";
  }

  if (platform === "tiktok") {
    return processTikTok(cleanInput, headers);
  } else if (platform === "facebook") {
    return processFacebook(cleanInput, headers);
  } else if (platform === "instagram") {
    return processInstagram(cleanInput, headers);
  } else {
    return processYoutube(cleanInput, headers);
  }
}

// =====================================
// 1 & 2. YOUTUBE PROCESSOR
// =====================================
async function processYoutube(cleanInput: string, headers: Record<string, string>): Promise<SocialResult> {
  let handleOrChannelId = "";
  const videoMatch =
    cleanInput.match(/(?:watch\?v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
    cleanInput.match(/^([a-zA-Z0-9_-]{11})$/);

  if (videoMatch && (cleanInput.includes("youtube.com") || cleanInput.includes("youtu.be") || cleanInput.startsWith("http"))) {
    const videoId = videoMatch[1];
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

  const [videos, shorts] = await Promise.all([
    fetchYoutubeTabLinks(baseChannelUrl, "videos", headers),
    fetchYoutubeTabLinks(baseChannelUrl, "shorts", headers),
  ]);

  return {
    platform: "youtube",
    channel: handleOrChannelId.startsWith("@") ? handleOrChannelId : `@${handleOrChannelId}`,
    channelUrl: baseChannelUrl,
    videos,
    shorts,
  };
}

async function fetchYoutubeTabLinks(baseChannelUrl: string, mode: "videos" | "shorts", headers: Record<string, string>): Promise<string[]> {
  const targetUrl = `${baseChannelUrl}/${mode}`;
  const videoIds = new Set<string>();

  let res = await fetch(targetUrl, { headers, cache: "no-store" });
  if (!res.ok) {
    res = await fetch(baseChannelUrl, { headers, cache: "no-store" });
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

// =====================================
// 3. TIKTOK PROCESSOR
// =====================================
async function processTikTok(cleanInput: string, headers: Record<string, string>): Promise<SocialResult> {
  let username = "";

  const userMatch = cleanInput.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/) || cleanInput.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (userMatch) {
    username = userMatch[1];
  } else if (cleanInput.startsWith("http")) {
    try {
      const urlObj = new URL(cleanInput);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const atPart = pathParts.find((p) => p.startsWith("@"));
      if (atPart) username = atPart.replace(/^@/, "");
    } catch {
      username = cleanInput.replace(/^@/, "");
    }
  } else {
    username = cleanInput.replace(/^@/, "");
  }

  if (!username) {
    throw new Error("Could not parse TikTok username from input");
  }

  const profileUrl = `https://www.tiktok.com/@${username}`;
  const tiktokHeaders = {
    "User-Agent": "TikTok 26.1.3 rv:261303 (iPhone; iOS 14.4.2; en_US) Cronet",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const videoIds = new Set<string>();

  try {
    const res = await fetch(profileUrl, { headers: tiktokHeaders, cache: "no-store" });
    if (res.ok) {
      const html = await res.text();
      const matches = html.matchAll(/"(7\d{18})"/g);
      for (const m of matches) {
        if (m[1]) videoIds.add(m[1]);
      }
      const videoMatches = html.matchAll(/\/video\/(\d{15,22})/g);
      for (const m of videoMatches) {
        if (m[1]) videoIds.add(m[1]);
      }
    }
  } catch {
    // Fallback silent
  }

  const directVideoMatch = cleanInput.match(/\/video\/(\d{15,22})/);
  if (directVideoMatch && directVideoMatch[1]) {
    videoIds.add(directVideoMatch[1]);
  }

  const allLinks = Array.from(videoIds).map((id) => `https://www.tiktok.com/@${username}/video/${id}`);

  return {
    platform: "tiktok",
    channel: `@${username}`,
    channelUrl: profileUrl,
    videos: allLinks,
    shorts: allLinks,
  };
}

// =====================================
// 4. FACEBOOK PROCESSOR (STRICT REAL DATA ONLY)
// =====================================
async function processFacebook(cleanInput: string, headers: Record<string, string>): Promise<SocialResult> {
  let pageName = "";
  let isNumericId = false;
  let numericId = "";

  // 1. Direct Reel or Video URL or Share Link
  const directReelMatch = cleanInput.match(/\/(?:reel|reels|share\/r)\/(\d+)/) || cleanInput.match(/fbid=(\d+)/);
  const directWatchMatch = cleanInput.match(/\/(?:watch\/\?v=|videos\/|share\/v)\/(\d+)/);

  // 2. Extract Fanpage handle or ID
  const numericIdMatch = cleanInput.match(/profile\.php\?id=(\d+)/) || cleanInput.match(/facebook\.com\/(\d{10,20})/);
  const matchPath = cleanInput.match(/facebook\.com\/([a-zA-Z0-9_.-]+)\/(?:reels?|videos?|posts?|photos?)/);
  const matchPage = cleanInput.match(/facebook\.com\/([a-zA-Z0-9_.-]+)/);

  if (numericIdMatch && numericIdMatch[1]) {
    isNumericId = true;
    numericId = numericIdMatch[1];
    pageName = numericId;
  } else if (matchPath && matchPath[1]) {
    pageName = matchPath[1];
  } else if (matchPage && !["watch", "reel", "reels", "videos", "share", "plugins", "p"].includes(matchPage[1])) {
    pageName = matchPage[1];
  } else if (cleanInput.startsWith("@")) {
    pageName = cleanInput.replace(/^@/, "");
  } else {
    pageName = cleanInput.replace(/^https?:\/\/(www\.)?facebook\.com\//, "").split("/")[0].split("?")[0];
  }

  if (!pageName) {
    pageName = "Facebook Page";
  }

  let pageUrl = "";
  let reelsUrl = "";

  if (isNumericId) {
    pageUrl = `https://www.facebook.com/profile.php?id=${numericId}`;
    reelsUrl = `https://www.facebook.com/profile.php?id=${numericId}&sk=reels_tab`;
  } else if (pageName !== "Facebook Page") {
    pageUrl = `https://www.facebook.com/${pageName}`;
    reelsUrl = `https://www.facebook.com/${pageName}/reels/`;
  } else {
    pageUrl = cleanInput;
    reelsUrl = cleanInput;
  }

  const reelIds = new Set<string>();
  const watchIds = new Set<string>();

  if (directReelMatch && directReelMatch[1]) {
    reelIds.add(directReelMatch[1]);
  }
  if (directWatchMatch && directWatchMatch[1]) {
    watchIds.add(directWatchMatch[1]);
  }

  const fbBrowserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cookie": "datr=1234567890abcdef; sb=1234567890abcdef",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  const urlsToFetch = [reelsUrl];
  if (!isNumericId && pageUrl !== reelsUrl) {
    urlsToFetch.push(pageUrl);
  }

  for (const fetchUrl of urlsToFetch) {
    try {
      const res = await fetch(fetchUrl, { headers: fbBrowserHeaders, cache: "no-store" });
      if (res.ok) {
        const html = await res.text();
        extractRealFacebookHrefsOnly(html, reelIds, watchIds);
      }
    } catch {
      // Ignore error and continue
    }
  }

  // Fallback to plugin URL if no reels found yet
  if (reelIds.size === 0 && pageName !== "Facebook Page") {
    try {
      const pluginUrl = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(pageUrl)}&tabs=timeline,videos&width=500&height=1000`;
      const res = await fetch(pluginUrl, { headers: fbBrowserHeaders, cache: "no-store" });
      if (res.ok) {
        const html = await res.text();
        extractRealFacebookHrefsOnly(html, reelIds, watchIds);
      }
    } catch {
      // Silent
    }
  }

  const reelLinks = Array.from(reelIds).map((id) => `https://www.facebook.com/reel/${id}`);
  const watchLinks = Array.from(watchIds).map((id) => `https://www.facebook.com/watch/?v=${id}`);

  return {
    platform: "facebook",
    channel: pageName.startsWith("@") ? pageName : `@${pageName}`,
    channelUrl: pageUrl,
    videos: watchLinks.length > 0 ? watchLinks : reelLinks,
    shorts: reelLinks,
  };
}

function extractRealFacebookHrefsOnly(html: string, reelIds: Set<string>, watchIds: Set<string>) {
  // 1. Escaped reel paths \/reel\/123456... or \/reels\/123456...
  const escapedReels = html.matchAll(/\\\/reels?\\\/(\d{10,20})/gi);
  for (const m of escapedReels) {
    if (m[1]) reelIds.add(m[1]);
  }

  // 2. Direct reel paths /reel/123456... or /reels/123456...
  const directReels = html.matchAll(/\/(?:reel|reels)\/(\d{10,20})/gi);
  for (const m of directReels) {
    if (m[1]) reelIds.add(m[1]);
  }

  // 3. JSON keys reel_id or target_id
  const jsonReels = html.matchAll(/"(?:reel_id|target_id)":\s*["']?(\d{10,20})["']?/gi);
  for (const m of jsonReels) {
    if (m[1]) reelIds.add(m[1]);
  }

  // 4. facebook.com/reel/ or facebook.com/reels/
  const fullUrlReels = html.matchAll(/facebook\.com\\?\/(?:reel|reels)\\\/(\d{10,20})/gi);
  for (const m of fullUrlReels) {
    if (m[1]) reelIds.add(m[1]);
  }

  // 5. Watch & video hrefs
  const watchHrefMatches = html.matchAll(/(?:watch\/\?v=|videos\/)(\d{10,20})/gi);
  for (const m of watchHrefMatches) {
    if (m[1]) watchIds.add(m[1]);
  }
}

// =====================================
// 5. INSTAGRAM PROCESSOR
// =====================================
async function processInstagram(cleanInput: string, headers: Record<string, string>): Promise<SocialResult> {
  let username = "";
  const matchUser = cleanInput.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/) || cleanInput.match(/^@([a-zA-Z0-9_.-]+)$/);

  if (matchUser && !["p", "reel", "reels", "stories", "tv"].includes(matchUser[1])) {
    username = matchUser[1];
  } else {
    username = cleanInput.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split("/")[0];
  }

  if (!username) {
    username = "Instagram User";
  }

  const profileUrl = `https://www.instagram.com/${username}/`;
  const postCodes = new Set<string>();
  const reelCodes = new Set<string>();

  const directPost = cleanInput.match(/\/p\/([a-zA-Z0-9_-]+)/);
  if (directPost && directPost[1]) {
    postCodes.add(directPost[1]);
    reelCodes.add(directPost[1]);
  }

  const directReel = cleanInput.match(/\/reel\/([a-zA-Z0-9_-]+)/);
  if (directReel && directReel[1]) {
    reelCodes.add(directReel[1]);
    postCodes.add(directReel[1]);
  }

  return {
    platform: "instagram",
    channel: `@${username}`,
    channelUrl: profileUrl,
    videos: Array.from(postCodes).map((code) => `https://www.instagram.com/p/${code}/`),
    shorts: Array.from(reelCodes).map((code) => `https://www.instagram.com/reel/${code}/`),
  };
}
