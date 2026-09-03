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
    const customReferer = searchParams.get("referer") || `${targetUrl.origin}/`;
    
    const headers = new Headers();
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    headers.set("Referer", customReferer);
    headers.set("Origin", targetUrl.origin);
    headers.set("Accept", "*/*");

    const response = await fetch(targetUrl.toString(), {
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

    const contentType = response.headers.get("content-type") || "text/html; charset=UTF-8";
    const data = await response.text();

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url") || "https://www.123-hdx.com/api/get.php";

  try {
    const targetUrl = new URL(targetUrlStr);
    const customReferer = searchParams.get("referer") || `${targetUrl.origin}/`;

    const body = await request.json();
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, String(value));
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    headers.set("Referer", customReferer);
    headers.set("Origin", targetUrl.origin);
    headers.set("X-Requested-With", "XMLHttpRequest");

    const response = await fetch(targetUrlStr, {
      method: "POST",
      headers,
      body: formData.toString(),
      cache: "no-store",
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
