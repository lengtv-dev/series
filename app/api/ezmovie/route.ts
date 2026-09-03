import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url");

  if (!targetUrlStr) {
    return NextResponse.json(
      { error: "Missing 'url' parameter" },
      { status: 400 }
    );
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    const hostname = targetUrl.hostname;

    // Allowed domains for EzMovie proxying to maintain robust scraping.
    // Allow ezmovie.movie domains plus typical player / CDN embeds or general domain patterns.
    const isAllowed = 
      hostname === "ezmovie.movie" ||
      hostname.endsWith(".ezmovie.movie") ||
      hostname.endsWith(".com") ||
      hostname.endsWith(".net") ||
      hostname.endsWith(".org") ||
      hostname.endsWith(".to") ||
      hostname.endsWith(".me") ||
      hostname.endsWith(".club") ||
      hostname.endsWith(".xyz") ||
      hostname.endsWith(".cc") ||
      hostname === "picsum.photos";

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Forbidden target domain in ezmovie proxy: " + hostname },
        { status: 403 }
      );
    }

    const headers = new Headers();
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    headers.set("Referer", "https://ezmovie.movie/");
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8");

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
      { error: "Error fetching resource: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
