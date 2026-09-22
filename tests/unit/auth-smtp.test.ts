import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthMailer } from "../../src/lib/auth/mail";

describe("SMTP local de autenticação", () => {
  const messages: string[] = [];
  const server = createServer((socket) => {
    socket.write("220 fixture.local ESMTP\r\n");
    let buffer = "";
    let body = "";
    let dataMode = false;
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (dataMode) {
          if (line === ".") {
            messages.push(body);
            body = "";
            dataMode = false;
            socket.write("250 queued\r\n");
          } else body += line + "\n";
        } else if (/^EHLO /i.test(line)) socket.write("250-fixture.local\r\n250 SIZE 1048576\r\n");
        else if (/^HELO /i.test(line)) socket.write("250 fixture.local\r\n");
        else if (/^(MAIL FROM|RCPT TO):/i.test(line)) socket.write("250 ok\r\n");
        else if (line === "DATA") { dataMode = true; socket.write("354 end with dot\r\n"); }
        else if (line === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 ok\r\n");
      }
    });
  });
  let port: number;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fake SMTP has no TCP port");
    port = address.port;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("entrega link de verificação para servidor SMTP fake local", async () => {
    const send = createAuthMailer({
      NODE_ENV: "test",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(port),
      SMTP_FROM: "noreply@orvok.test",
      APP_ORIGIN: "http://127.0.0.1:3000",
      APP_ENV: "test",
    });
    await send({ email: "fixture@example.test", purpose: "VERIFY_EMAIL", token: "a".repeat(43) });
    expect(messages).toHaveLength(1);
    const decoded = messages[0]!.replace(/=\n/g, "").replace(/=3D/g, "=");
    expect(decoded).toContain("/verificar-email#token=");
    expect(messages[0]).toContain("fixture@example.test");
  });
});
