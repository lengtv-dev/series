import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url") || "https://moviesdoofree.com/";

  try {
    const targetUrl = new URL(targetUrlStr);
    const headers = new Headers();
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    );
    headers.set(
      "Accept",
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    );
    headers.set("Accept-Language", "th-TH,th;q=0.8,en-US;q=0.5,en;q=0.3");
    headers.set("Referer", "https://moviesdoofree.com/");

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `MoviesDooFree target returned status ${response.status}` },
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
      { error: "Error fetching MoviesDooFree resource: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
