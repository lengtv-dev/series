import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const targetUrlStr = searchParams.get("url") || searchParams.get("watchUrl");

  if (!targetUrlStr) {
    return NextResponse.json(
      { error: "Missing 'url' or 'watchUrl' parameter" },
      { status: 400 }
    );
  }

  // Handle server-side stream resolution for SeriesIndy episode
  if (action === "resolve_stream") {
    try {
      const epRes = await fetch(targetUrlStr, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://seriesindy.com/",
        },
        cache: "no-store",
      });

      if (!epRes.ok) {
        return NextResponse.json(
          { error: `Episode page returned status ${epRes.status}` },
          { status: epRes.status }
        );
      }

      const epHtml = await epRes.text();
      const iframeMatch = epHtml.match(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/i);
      if (!iframeMatch) {
        return NextResponse.json({ error: "No iframe found in episode page" }, { status: 404 });
      }

      let iframeUrl = iframeMatch[1];
      iframeUrl = iframeUrl.replace("https://proxy.team-indy.net/", "https://play.anime-kame.xyz/");

      const iframeUri = new URL(iframeUrl);
      const ifrReferer = `${iframeUri.protocol}//${iframeUri.hostname}/`;

      const ifrRes = await fetch(iframeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://seriesindy.com/",
        },
        cache: "no-store",
      });

      let purl = await ifrRes.text();
      purl = purl.replace(/\r/g, "").replace(/\n/g, "");

      let elink = "";

      // 1. runplayer pattern
      const runMatch = purl.match(/runplayer\([^,]+,\s*['"]([^'"]+)['"]/);
      if (runMatch) {
        elink = runMatch[1];
      } else if (purl.includes('"GET",') || purl.includes("'GET',")) {
        const getMatch = purl.match(/["']GET["']\s*,\s*["']([^"']+)["']/);
        const ajxMatch = purl.match(/ajxurl\s*=\s*['"]([^'"]+)['"]/);
        const slugMatch = purl.match(/slug\s*=\s*['"]([^'"]+)['"]/);
        if (ajxMatch && slugMatch) {
          const ajaxUrl = ajxMatch[1] + slugMatch[1];
          const ajaxRes = await fetch(ajaxUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Referer: ifrReferer,
            },
            cache: "no-store",
          });
          const ajData = await ajaxRes.json();
          elink = ajData.url || "";
        } else if (getMatch) {
          elink = getMatch[1];
        }
      } else if (purl.match(/var\s+fulllink\s*=\s*['"]([^'"]+)['"]/)) {
        elink = purl.match(/var\s+fulllink\s*=\s*['"]([^'"]+)['"]/)?.[1] || "";
      } else if (purl.match(/"file"\s*:\s*"([^"]+)"/)) {
        elink = (purl.match(/"file"\s*:\s*"([^"]+)"/)?.[1] || "")
          .replace(/\\/g, "")
          .replace(/^\/\//, "https://");
      } else if (purl.match(/null,0,null,"([^"]+)"/)) {
        elink = purl.match(/null,0,null,"([^"]+)"/)?.[1] || "";
      } else {
        const m3u8Match = purl.match(/(https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*)/);
        if (m3u8Match) elink = m3u8Match[1];
      }

      return NextResponse.json({
        success: !!elink,
        streamUrl: elink,
        iframeUrl,
        referer: ifrReferer,
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: "Error resolving stream: " + (error?.message || String(error)) },
        { status: 500 }
      );
    }
  }

  // General proxy fetching
  try {
    const targetUrl = new URL(targetUrlStr);
    const headers = new Headers();
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const customReferer = searchParams.get("referer");
    headers.set(
      "Referer",
      customReferer || `${targetUrl.protocol}//${targetUrl.hostname}/`
    );
    headers.set(
      "Accept",
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    );
    headers.set("Accept-Language", "th,en-US;q=0.9,en;q=0.8");

    const response = await fetch(targetUrlStr, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Target server returned status ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const text = await response.text();
      return new NextResponse(text, {
        headers: {
          "Content-Type": contentType || "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error fetching SeriesIndy resource: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
