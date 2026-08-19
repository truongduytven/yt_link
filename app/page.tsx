"use client";

import { useState, useMemo } from "react";

type PlatformTab = "youtube_video" | "youtube_channel" | "tiktok";

interface SocialResult {
  platform: "youtube" | "tiktok" | "facebook" | "instagram";
  channel: string;
  channelUrl: string;
  videos: string[];
  shorts: string[];
}

export default function Home() {
  const [activePlatform, setActivePlatform] = useState<PlatformTab>("youtube_video");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SocialResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"videos-json" | "shorts-json" | "all-json" | "videos-raw" | "shorts-raw" | null>(null);
  const [resultTab, setResultTab] = useState<"videos" | "shorts" | "combined">("videos");

  // Platform Tab Configurations
  const platformConfigs = {
    youtube_video: {
      label: "YouTube Video Link",
      icon: "🔴",
      placeholder: "Dán link video YouTube bất kỳ (vd: https://www.youtube.com/watch?v=... hoặc https://youtu.be/...)",
      desc: "Nhập 1 link video YouTube duy nhất. Hệ thống tự dò Kênh sở hữu và xuất ra cả 2 mảng Videos Thường & Shorts.",
      apiKey: "youtube",
    },
    youtube_channel: {
      label: "YouTube Kênh Channel",
      icon: "▶️",
      placeholder: "Nhập Kênh YouTube (vd: @Fireship hoặc https://www.youtube.com/@Fireship)",
      desc: "Nhập handle hoặc URL kênh YouTube. Hệ thống xuất ra đồng thời 2 mảng Videos Thường & Shorts.",
      apiKey: "youtube",
    },
    tiktok: {
      label: "TikTok",
      icon: "🎵",
      placeholder: "Dán link Video TikTok hoặc ID/Profile (vd: https://www.tiktok.com/@username/video/... hoặc @username)",
      desc: "Bóc tách danh sách video/shorts từ link Video TikTok hoặc trang cá nhân TikTok.",
      apiKey: "tiktok",
    },
  };

  // Cross-Platform Link Mismatch Warning
  const platformWarning = useMemo(() => {
    const clean = url.trim();
    if (!clean) return null;

    if (!activePlatform.startsWith("youtube") && (clean.includes("youtube.com") || clean.includes("youtu.be"))) {
      return {
        message: "Phát hiện đây là link YouTube. Bạn có muốn chuyển sang tab YouTube?",
        suggestPlatform: clean.includes("watch?v=") || clean.includes("shorts/") ? ("youtube_video" as PlatformTab) : ("youtube_channel" as PlatformTab),
      };
    }

    if (activePlatform !== "tiktok" && clean.includes("tiktok.com")) {
      return {
        message: "Phát hiện đây là link TikTok. Bạn có muốn chuyển sang tab TikTok?",
        suggestPlatform: "tiktok" as PlatformTab,
      };
    }

    return null;
  }, [url, activePlatform]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    const platformApi = platformConfigs[activePlatform].apiKey;

    try {
      const res = await fetch("/api/youtube-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), platform: platformApi }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to process request");
      }

      setData(resData);
      if (resData.platform === "facebook" || (resData.videos?.length === 0 && resData.shorts?.length > 0)) {
        setResultTab("shorts");
      } else {
        setResultTab("videos");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: typeof copiedType) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadTxtFile = (links: string[], filename: string) => {
    if (!links || links.length === 0) return;
    const cleanContent = links
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([cleanContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentCfg = platformConfigs[activePlatform];

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 md:p-12 overflow-hidden bg-[#070a12] text-slate-100">
      {/* Background Glow Circles */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-red-600/30 via-rose-500/20 to-purple-600/20 blur-[120px] rounded-full pointer-events-none animate-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/15 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-6 my-auto py-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-rose-400 text-xs font-semibold tracking-wide uppercase shadow-lg">
            <span>✨ Multi-Social Media Video Link Extractor</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Bóc Tách Link Social Media
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Hỗ trợ bóc tách danh sách Video & Shorts từ YouTube và TikTok.
          </p>
        </div>

        {/* 5 Platform Selector Tabs */}
        <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto shadow-2xl scrollbar-none">
          {(Object.keys(platformConfigs) as PlatformTab[]).map((tabKey) => {
            const cfg = platformConfigs[tabKey];
            const isActive = activePlatform === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActivePlatform(tabKey)}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-1 ${
                  isActive
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Platform Guidance Banner */}
        <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3">
          <span className="text-base shrink-0 mt-0.5">{currentCfg.icon}</span>
          <div>
            <p>
              <strong className="text-white">{currentCfg.label}:</strong> {currentCfg.desc}
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-rose-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
            <div className="relative flex flex-col sm:flex-row items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
              <div className="flex items-center pl-3 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={currentCfg.placeholder}
                className="w-full bg-transparent px-3 py-3 text-slate-100 placeholder-slate-500 focus:outline-none text-sm sm:text-base"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium text-sm rounded-xl transition duration-200 shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang bóc tách...
                  </>
                ) : (
                  <>
                    Bóc tách link
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Platform Conflict Warning */}
        {platformWarning && (
          <div className="w-full max-w-2xl p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <p>{platformWarning.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePlatform(platformWarning.suggestPlatform)}
              className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Chuyển sang tab {platformConfigs[platformWarning.suggestPlatform].label}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="w-full max-w-2xl p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Lỗi xảy ra</p>
              <p className="text-red-300/80">{error}</p>
            </div>
          </div>
        )}

        {/* Output Section */}
        {data && (
          <div className="w-full max-w-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Platform & Channel Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-xs uppercase">
                  {data.platform.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{data.channel}</span>
                    <a
                      href={data.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Mở Kênh ↗
                    </a>
                  </div>
                  <p className="text-xs text-slate-400 capitalize">
                    Platform: <strong className="text-slate-200">{data.platform}</strong> &bull; {data.videos.length} Videos/Posts &bull; {data.shorts.length} Shorts/Reels
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadTxtFile(Array.from(new Set([...data.videos, ...data.shorts])), `${data.channel.replace(/[^a-zA-Z0-9_-]/g, "_")}_all_links.txt`)}
                  className="px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition border border-emerald-500/30 shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải File .TXT (Tất Cả)
                </button>

                <button
                  onClick={() => copyToClipboard(JSON.stringify(data, null, 2), "all-json")}
                  className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold rounded-xl transition border border-red-500/30 shadow-lg shadow-red-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedType === "all-json" ? (
                    <span className="text-emerald-300 font-bold">✓ Copied Object JSON</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy JSON
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output Sub-Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setResultTab("videos")}
                  className={`px-3.5 py-1.5 rounded-lg transition font-semibold cursor-pointer flex items-center gap-1.5 ${
                    resultTab === "videos" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🎬 Videos / Posts ({data.videos.length})
                </button>
                <button
                  onClick={() => setResultTab("shorts")}
                  className={`px-3.5 py-1.5 rounded-lg transition font-semibold cursor-pointer flex items-center gap-1.5 ${
                    resultTab === "shorts" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ Shorts / Reels ({data.shorts.length})
                </button>
                <button
                  onClick={() => setResultTab("combined")}
                  className={`px-3.5 py-1.5 rounded-lg transition font-semibold cursor-pointer flex items-center gap-1.5 ${
                    resultTab === "combined" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  📦 Combined Object
                </button>
              </div>

              {/* Sub-tab actions */}
              <div className="flex flex-wrap items-center gap-2">
                {resultTab === "videos" && (
                  <>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(data.videos, null, 2), "videos-json")}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      {copiedType === "videos-json" ? "✓ Copied" : "Copy Videos Array"}
                    </button>
                    <button
                      onClick={() => copyToClipboard(data.videos.join("\n"), "videos-raw")}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      {copiedType === "videos-raw" ? "✓ Copied" : "Copy Raw Links"}
                    </button>
                    <button
                      onClick={() => downloadTxtFile(data.videos, `${data.channel.replace(/[^a-zA-Z0-9_-]/g, "_")}_videos.txt`)}
                      className="px-2.5 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg border border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📥</span> Tải TXT (Videos)
                    </button>
                  </>
                )}
                {resultTab === "shorts" && (
                  <>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(data.shorts, null, 2), "shorts-json")}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      {copiedType === "shorts-json" ? "✓ Copied" : "Copy Shorts Array"}
                    </button>
                    <button
                      onClick={() => copyToClipboard(data.shorts.join("\n"), "shorts-raw")}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      {copiedType === "shorts-raw" ? "✓ Copied" : "Copy Raw Links"}
                    </button>
                    <button
                      onClick={() => downloadTxtFile(data.shorts, `${data.channel.replace(/[^a-zA-Z0-9_-]/g, "_")}_shorts.txt`)}
                      className="px-2.5 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-medium rounded-lg border border-rose-500/40 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📥</span> Tải TXT (Shorts)
                    </button>
                  </>
                )}
                {resultTab === "combined" && (
                  <button
                    onClick={() => downloadTxtFile(Array.from(new Set([...data.videos, ...data.shorts])), `${data.channel.replace(/[^a-zA-Z0-9_-]/g, "_")}_all_links.txt`)}
                    className="px-2.5 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg border border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
                  >
                    <span>📥</span> Tải TXT Tất Cả
                  </button>
                )}
              </div>
            </div>

            {/* Display Box */}
            {resultTab === "videos" && (
              <pre className="p-4 bg-[#030712] border border-slate-800/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-mono text-emerald-400 max-h-[400px] overflow-y-auto leading-relaxed">
                <code>{JSON.stringify(data.videos, null, 2)}</code>
              </pre>
            )}

            {resultTab === "shorts" && (
              <pre className="p-4 bg-[#030712] border border-slate-800/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-mono text-rose-400 max-h-[400px] overflow-y-auto leading-relaxed">
                <code>{JSON.stringify(data.shorts, null, 2)}</code>
              </pre>
            )}

            {resultTab === "combined" && (
              <pre className="p-4 bg-[#030712] border border-slate-800/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-mono text-amber-300 max-h-[400px] overflow-y-auto leading-relaxed">
                <code>{JSON.stringify(data, null, 2)}</code>
              </pre>
            )}
          </div>
        )}

        {/* API Endpoint Documentation Box */}
        <div className="w-full max-w-2xl mt-2 p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl text-slate-400 text-xs space-y-2">
          <div className="font-semibold text-slate-300 flex items-center justify-between">
            <span>⚡ Multi-Platform API Access</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">POST /api/youtube-links</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            API tự động nhận diện nền tảng (YouTube, TikTok). Bạn chỉ cần truyền POST Body (<code className="text-rose-300 font-mono">{`{"url": "...", "platform": "auto"}`}</code>) hoặc GET Query (<code className="text-rose-300 font-mono">/api/youtube-links?url=...</code>). Kết quả bao gồm mảng <code className="text-emerald-400 font-mono">videos</code> và <code className="text-rose-400 font-mono">shorts</code>.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-xs text-slate-600 text-center py-4">
        Multi-Social Media Link Extractor &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
