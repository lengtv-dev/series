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
      { error: "Error fetching resource: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url") || "https://www.seriedays.com/api/get.php";

  try {
    const contentType = request.headers.get("content-type") || "";
    let bodyData: any;

    if (contentType.includes("application/json")) {
      const json = await request.json();
      bodyData = new URLSearchParams();
      for (const key of Object.keys(json)) {
        bodyData.append(key, json[key]);
      }
    } else {
      const text = await request.text();
      bodyData = text;
    }

    const targetUrl = new URL(targetUrlStr);
    const headers = new Headers();
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    headers.set("Referer", `${targetUrl.protocol}//${targetUrl.hostname}/`);
    headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    headers.set("X-Requested-With", "XMLHttpRequest");

    const response = await fetch(targetUrlStr, {
      method: "POST",
      headers,
      body: bodyData.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Target server returned status ${response.status}` },
        { status: response.status }
      );
    }

    const resContentType = response.headers.get("content-type") || "";
    if (resContentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const text = await response.text();
      return new NextResponse(text, {
        headers: {
          "Content-Type": resContentType || "text/html; charset=utf-8",
        },
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error posting to resource: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
