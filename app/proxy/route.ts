import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getCORSHeaders(responseHeaders?: Headers) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Allow-Credentials", "true");

  if (responseHeaders) {
    const contentType = responseHeaders.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    const contentLength = responseHeaders.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = responseHeaders.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    const acceptRanges = responseHeaders.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
  }

  return headers;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCORSHeaders(),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url");

  if (!targetUrlStr) {
    return NextResponse.json(
      {
        error: "Missing 'url' query parameter",
        usage: "/proxy/?url=https://wow-drama.com/&referer=https://wow-drama.com/",
      },
      {
        status: 400,
        headers: getCORSHeaders(),
      }
    );
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    const headers = new Headers();

    // User-Agent setup
    const customUA = searchParams.get("ua") || searchParams.get("user-agent");
    headers.set(
      "User-Agent",
      customUA ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    );

    // Referer setup
    const customReferer =
      searchParams.get("referer") ||
      searchParams.get("referrer") ||
      request.headers.get("x-referer") ||
      request.headers.get("x-target-referer");

    const defaultReferer = `${targetUrl.protocol}//${targetUrl.hostname}/`;
    headers.set("Referer", customReferer || defaultReferer);

    // Origin setup
    const customOrigin = searchParams.get("origin");
    headers.set("Origin", customOrigin || `${targetUrl.protocol}//${targetUrl.hostname}`);

    // Standard headers
    headers.set(
      "Accept",
      request.headers.get("accept") ||
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"
    );
    headers.set("Accept-Language", "th,en-US;q=0.9,en;q=0.8");

    // Forward Range header if requested (for video streaming chunks)
    const range = request.headers.get("range");
    if (range) {
      headers.set("Range", range);
    }

    const response = await fetch(targetUrlStr, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const resHeaders = getCORSHeaders(response.headers);
    const contentType = response.headers.get("content-type") || "";

    // For JSON content
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, {
        status: response.status,
        headers: resHeaders,
      });
    }

    // For binary or stream content (images, video streams, audio, buffer)
    const isBinaryOrMedia =
      contentType.includes("video/") ||
      contentType.includes("audio/") ||
      contentType.includes("image/") ||
      contentType.includes("octet-stream") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("application/vnd.apple.mpegurl");

    if (isBinaryOrMedia) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        headers: resHeaders,
      });
    }

    // Default text/html/m3u8 response
    const text = await response.text();
    if (!resHeaders.has("Content-Type")) {
      resHeaders.set("Content-Type", contentType || "text/html; charset=utf-8");
    }

    return new NextResponse(text, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error proxying resource: " + (error?.message || String(error)) },
      { status: 500, headers: getCORSHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get("url");

  if (!targetUrlStr) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400, headers: getCORSHeaders() }
    );
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    const headers = new Headers();

    const customUA = searchParams.get("ua") || searchParams.get("user-agent");
    headers.set(
      "User-Agent",
      customUA ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    );

    const customReferer =
      searchParams.get("referer") ||
      searchParams.get("referrer") ||
      request.headers.get("x-referer");

    headers.set("Referer", customReferer || `${targetUrl.protocol}//${targetUrl.hostname}/`);
    headers.set("Origin", `${targetUrl.protocol}//${targetUrl.hostname}`);

    const reqContentType = request.headers.get("content-type");
    if (reqContentType) {
      headers.set("Content-Type", reqContentType);
    }

    const requestBody = await request.text();

    const response = await fetch(targetUrlStr, {
      method: "POST",
      headers,
      body: requestBody,
      cache: "no-store",
    });

    const resHeaders = getCORSHeaders(response.headers);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, {
        status: response.status,
        headers: resHeaders,
      });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error proxying POST request: " + (error?.message || String(error)) },
      { status: 500, headers: getCORSHeaders() }
    );
  }
}
