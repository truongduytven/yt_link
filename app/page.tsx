"use client";

import { useState, useMemo } from "react";

type ContentType = "videos" | "shorts";

export default function Home() {
  const [contentType, setContentType] = useState<ContentType>("videos");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"json" | "raw" | null>(null);
  const [activeTab, setActiveTab] = useState<"json" | "list">("json");

  // Check if input URL suffix conflicts with current selected tab
  const urlWarning = useMemo(() => {
    const clean = url.trim();
    if (!clean) return null;

    if (contentType === "videos" && clean.includes("/shorts")) {
      return {
        type: "mismatch",
        message: "Cảnh báo: Link của bạn chứa đuôi `/shorts` nhưng bạn đang chọn tab 'Videos Thường'. Hệ thống sẽ tự động bóc tách từ mục `/shorts` cho bạn.",
        suggestType: "shorts" as ContentType,
      };
    }

    if (contentType === "shorts" && clean.includes("/videos")) {
      return {
        type: "mismatch",
        message: "Cảnh báo: Link của bạn chứa đuôi `/videos` nhưng bạn đang chọn tab 'YouTube Shorts'. Hệ thống sẽ tự động bóc tách từ mục `/videos` cho bạn.",
        suggestType: "videos" as ContentType,
      };
    }

    return null;
  }, [url, contentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setLinks(null);

    try {
      const res = await fetch("/api/youtube-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), type: contentType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch YouTube links");
      }

      setLinks(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJSON = () => {
    if (!links) return;
    navigator.clipboard.writeText(JSON.stringify(links, null, 2));
    setCopiedType("json");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyRaw = () => {
    if (!links) return;
    navigator.clipboard.writeText(links.join("\n"));
    setCopiedType("raw");
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
            YouTube Channel Link Extractor
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Bóc Tách Link Video YouTube
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Chọn loại nội dung bạn muốn bóc tách và nhập URL kênh hoặc @handle bên dưới.
          </p>
        </div>

        {/* Content Type Selector Tabs */}
        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center shadow-xl">
          <button
            type="button"
            onClick={() => setContentType("videos")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
              contentType === "videos"
                ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Videos Thường <code className="text-[11px] font-mono opacity-80">(/videos)</code>
          </button>
          <button
            type="button"
            onClick={() => setContentType("shorts")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
              contentType === "shorts"
                ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            YouTube Shorts <code className="text-[11px] font-mono opacity-80">(/shorts)</code>
          </button>
        </div>

        {/* Tab Explanation Banner */}
        <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3">
          <span className="text-base shrink-0 mt-0.5">ℹ️</span>
          <div>
            {contentType === "videos" ? (
              <p>
                <strong className="text-white">Tab Videos Thường (`/videos`):</strong> YouTube phân loại riêng các video dài truyền thống ở đường dẫn đuôi <code className="text-rose-400 font-mono">/videos</code> của kênh.
              </p>
            ) : (
              <p>
                <strong className="text-white">Tab YouTube Shorts (`/shorts`):</strong> Các video ngắn dạng dọc (Shorts) được YouTube tách riêng ra ở đường dẫn đuôi <code className="text-rose-400 font-mono">/shorts</code> của kênh.
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
                  contentType === "videos"
                    ? "Nhập kênh (vd: @Fireship hoặc https://www.youtube.com/@Fireship/videos)"
                    : "Nhập kênh (vd: @Fireship hoặc https://www.youtube.com/@Fireship/shorts)"
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
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Lấy {contentType === "shorts" ? "Shorts" : "Videos"}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Input URL Conflict Warning */}
        {urlWarning && (
          <div className="w-full max-w-2xl p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <p>{urlWarning.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setContentType(urlWarning.suggestType)}
              className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Chuyển sang tab {urlWarning.suggestType === "shorts" ? "Shorts" : "Videos Thường"}
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
        {links && (
          <div className="w-full max-w-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
                  {links.length} {contentType === "shorts" ? "Shorts" : "Videos"} Found
                </span>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setActiveTab("json")}
                    className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                      activeTab === "json" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    JSON Array
                  </button>
                  <button
                    onClick={() => setActiveTab("list")}
                    className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                      activeTab === "list" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    List Links
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJSON}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedType === "json" ? (
                    <span className="text-emerald-400 font-semibold">✓ Copied JSON</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Array JSON
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopyRaw}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedType === "raw" ? (
                    <span className="text-emerald-400 font-semibold">✓ Copied Raw</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Copy Raw Links
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Display Area */}
            {activeTab === "json" ? (
              <pre className="p-4 bg-[#030712] border border-slate-800/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-mono text-emerald-400 max-h-[420px] overflow-y-auto leading-relaxed">
                <code>{JSON.stringify(links, null, 2)}</code>
              </pre>
            ) : (
              <div className="p-3 bg-[#030712] border border-slate-800/80 rounded-xl max-h-[420px] overflow-y-auto space-y-2">
                {links.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-900/50 hover:bg-slate-800/60 rounded-lg border border-slate-800 text-xs font-mono group transition"
                  >
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-300 hover:text-red-400 truncate pr-2"
                    >
                      {link}
                    </a>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-slate-500 hover:text-white px-2 py-1 bg-slate-800 rounded text-[10px]"
                    >
                      Open ↗
                    </a>
                  </div>
                ))}
              </div>
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
            Bạn có thể truyền tham số <code className="text-rose-300 font-mono">type: "videos"</code> hoặc <code className="text-rose-300 font-mono">type: "shorts"</code> qua POST Body (<code className="text-rose-300 font-mono">{`{"url": "@handle", "type": "shorts"}`}</code>) hoặc GET Query (<code className="text-rose-300 font-mono">/api/youtube-links?channel=@handle&type=shorts</code>).
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-xs text-slate-600 text-center py-4">
        YouTube Channel Link Extractor &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
