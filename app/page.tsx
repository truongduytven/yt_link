"use client";

import { useState, useMemo } from "react";

type InputMode = "video" | "channel";

interface ApiResponse {
  channel: string;
  channelUrl: string;
  videos: string[];
  shorts: string[];
}

export default function Home() {
  const [mode, setMode] = useState<InputMode>("video");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"videos-json" | "shorts-json" | "all-json" | "videos-raw" | "shorts-raw" | null>(null);
  const [resultTab, setResultTab] = useState<"videos" | "shorts" | "combined">("videos");

  // Detect input URL mismatch with active mode
  const modeWarning = useMemo(() => {
    const clean = url.trim();
    if (!clean) return null;

    const isVideoLink = clean.includes("watch?v=") || clean.includes("shorts/") || clean.includes("youtu.be/");
    const isChannelLink = clean.startsWith("@") || clean.includes("/@") || clean.includes("/channel/");

    if (mode === "video" && isChannelLink && !isVideoLink) {
      return {
        message: "Phát hiện đây là link Kênh Channel. Bạn có muốn chuyển sang chế độ 'Theo Kênh Channel'?",
        suggestMode: "channel" as InputMode,
      };
    }

    if (mode === "channel" && isVideoLink) {
      return {
        message: "Phát hiện đây là link Video. Bạn có muốn chuyển sang chế độ 'Theo Link Video' (tự bóc tách Kênh)?",
        suggestMode: "video" as InputMode,
      };
    }

    return null;
  }, [url, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/youtube-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to process request");
      }

      setData(resData);
      // Auto default to tab with content
      if (resData.videos?.length === 0 && resData.shorts?.length > 0) {
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

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 md:p-12 overflow-hidden bg-[#070a12] text-slate-100">
      {/* Background Glow Circles */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-red-600/30 via-rose-500/20 to-purple-600/20 blur-[120px] rounded-full pointer-events-none animate-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/15 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-6 my-auto py-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold tracking-wide uppercase">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            YouTube Channel & Video Dual Link Extractor
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Lấy 2 Mảng Video & Shorts
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Nhập 1 link video bất kỳ (hệ thống tự bóc tách Kênh) hoặc nhập URL Kênh trực tiếp để xuất 2 danh sách video.
          </p>
        </div>

        {/* Input Mode Switcher Tabs */}
        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center shadow-xl">
          <button
            type="button"
            onClick={() => setMode("video")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === "video"
                ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Nhập 1 Link Video
          </button>
          <button
            type="button"
            onClick={() => setMode("channel")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === "channel"
                ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            Nhập Kênh Channel
          </button>
        </div>

        {/* Mode Explanation Banner */}
        <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3">
          <span className="text-base shrink-0 mt-0.5">💡</span>
          <div>
            {mode === "video" ? (
              <p>
                <strong className="text-white">Chế độ Link Video:</strong> Bạn chỉ cần dán 1 link video bất kỳ của kênh (vd: <code className="text-rose-400 font-mono">youtube.com/watch?v=...</code>). Hệ thống sẽ tự tìm Kênh sở hữu video đó và lấy đủ **2 mảng videos & shorts** của kênh!
              </p>
            ) : (
              <p>
                <strong className="text-white">Chế độ Kênh Channel:</strong> Nhập URL kênh hoặc handle (vd: <code className="text-rose-400 font-mono">@Fireship</code> hoặc <code className="text-rose-400 font-mono">youtube.com/@Fireship</code>). Hệ thống sẽ trả về đồng thời **2 mảng videos & shorts**!
              </p>
            )}
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
                placeholder={
                  mode === "video"
                    ? "Dán link video bất kỳ (vd: https://www.youtube.com/watch?v=... hoặc https://youtu.be/...)"
                    : "Nhập kênh (vd: @Fireship hoặc https://www.youtube.com/@Fireship)"
                }
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
                    Bóc tách 2 danh sách
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Input Conflict Warning */}
        {modeWarning && (
          <div className="w-full max-w-2xl p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <p>{modeWarning.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(modeWarning.suggestMode)}
              className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Chuyển sang {modeWarning.suggestMode === "channel" ? "Theo Kênh Channel" : "Theo Link Video"}
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
            {/* Channel Info Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">
                  YT
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
                  <p className="text-xs text-slate-400">
                    {data.videos.length} Videos Thường &bull; {data.shorts.length} Shorts
                  </p>
                </div>
              </div>

              {/* Copy Combined JSON Button */}
              <button
                onClick={() => copyToClipboard(JSON.stringify(data, null, 2), "all-json")}
                className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold rounded-xl transition border border-red-500/30 shadow-lg shadow-red-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedType === "all-json" ? (
                  <span className="text-emerald-300 font-bold">✓ Copied Both JSON</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Tất Cả JSON (Videos + Shorts)
                  </>
                )}
              </button>
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
                  🎬 Videos ({data.videos.length})
                </button>
                <button
                  onClick={() => setResultTab("shorts")}
                  className={`px-3.5 py-1.5 rounded-lg transition font-semibold cursor-pointer flex items-center gap-1.5 ${
                    resultTab === "shorts" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ Shorts ({data.shorts.length})
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
              <div className="flex items-center gap-2">
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
                  </>
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
            <span>⚡ API Endpoint Access</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">POST /api/youtube-links</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            API tự động xử lý cả link Video lẫn link Kênh Channel. Bạn có thể gọi POST Body (<code className="text-rose-300 font-mono">{`{"url": "https://www.youtube.com/watch?v=..."}`}</code>) hoặc GET Query (<code className="text-rose-300 font-mono">/api/youtube-links?url=@handle</code>). Kết quả trả về gồm <code className="text-emerald-400 font-mono">videos</code> và <code className="text-rose-400 font-mono">shorts</code>.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-xs text-slate-600 text-center py-4">
        YouTube Dual Extractor &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
