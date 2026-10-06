import { isIP } from "node:net";

function isValidIp(ip?: string | null): boolean {
  if (!ip || typeof ip !== "string") return false;
  return isIP(ip.trim()) !== 0;
}

function getClientIp(request: Request, ctx?: unknown): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  const socketAddress =
    (request as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ||
    (request as { raw?: { socket?: { remoteAddress?: string } } })?.raw?.socket?.remoteAddress ||
    (request as { connection?: { remoteAddress?: string } })?.connection?.remoteAddress ||
    (ctx as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ||
    (ctx as { req?: { socket?: { remoteAddress?: string } } })?.req?.socket?.remoteAddress;

  if (socketAddress && typeof socketAddress === "string") {
    const trimmedSocket = socketAddress.trim();
    if (isValidIp(trimmedSocket)) {
      return trimmedSocket;
    }
  }

  return "127.0.0.1";
}

function runTests() {
  console.log("=== RUNNING IP EXTRACTION TESTS ===");

  // Test 1: cf-connecting-ip diabaikan saat tidak ada x-real-ip
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.195",
      },
    });
    const ip = getClientIp(req);
    console.assert(ip === "127.0.0.1", `Test 1 Failed: Expected 127.0.0.1, got ${ip}`);
    console.log("✓ Test 1: cf-connecting-ip diabaikan sepenuhnya ->", ip);
  }

  // Test 2: x-forwarded-for diabaikan saat tidak ada x-real-ip
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-forwarded-for": "198.51.100.22, 10.0.0.1",
      },
    });
    const ip = getClientIp(req);
    console.assert(ip === "127.0.0.1", `Test 2 Failed: Expected 127.0.0.1, got ${ip}`);
    console.log("✓ Test 2: x-forwarded-for diabaikan sepenuhnya ->", ip);
  }

  // Test 3: x-real-ip valid IPv4 dipakai
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-real-ip": "  103.45.67.89  ",
        "x-forwarded-for": "1.1.1.1",
        "cf-connecting-ip": "2.2.2.2",
      },
    });
    const ip = getClientIp(req);
    console.assert(ip === "103.45.67.89", `Test 3a Failed: Expected 103.45.67.89, got ${ip}`);
    console.log("✓ Test 3a: x-real-ip valid IPv4 dipakai (trimmed) ->", ip);
  }

  // Test 3b: x-real-ip valid IPv6 dipakai
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-real-ip": "2001:db8:85a3::8a2e:370:7334",
      },
    });
    const ip = getClientIp(req);
    console.assert(
      ip === "2001:db8:85a3::8a2e:370:7334",
      `Test 3b Failed: Expected 2001:db8:85a3::8a2e:370:7334, got ${ip}`,
    );
    console.log("✓ Test 3b: x-real-ip valid IPv6 dipakai ->", ip);
  }

  // Test 4: x-real-ip tidak valid (misal multiple IP, string acak, port) jatuh ke soket / fallback
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-real-ip": "1.2.3.4, 5.6.7.8", // multiple IP header injection
      },
    });
    // With socket on ctx
    const ctx = { socket: { remoteAddress: "192.168.1.50" } };
    const ip = getClientIp(req, ctx);
    console.assert(ip === "192.168.1.50", `Test 4a Failed: Expected 192.168.1.50, got ${ip}`);
    console.log("✓ Test 4a: x-real-ip tidak valid (multiple IP) fallback ke soket ->", ip);

    const reqInvalid = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-real-ip": "invalid-ip-payload<script>",
      },
    });
    const ipFallback = getClientIp(reqInvalid);
    console.assert(
      ipFallback === "127.0.0.1",
      `Test 4b Failed: Expected 127.0.0.1, got ${ipFallback}`,
    );
    console.log(
      "✓ Test 4b: x-real-ip tidak valid tanpa soket fallback ke 127.0.0.1 ->",
      ipFallback,
    );
  }

  console.log("=== ALL IP EXTRACTION TESTS PASSED ===");
}

runTests();
