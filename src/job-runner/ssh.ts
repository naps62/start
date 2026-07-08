import { Client } from "ssh2";
import type { SshConfig } from "./types";

interface ParsedHost {
  username: string;
  host: string;
  port: number;
}

function parseHost(hostStr: string): ParsedHost {
  let username = "root";
  let host = hostStr;
  let port = 22;

  if (host.includes("@")) {
    const parts = host.split("@");
    username = parts[0];
    host = parts[1];
  }
  if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = parseInt(parts[1], 10);
  }

  return { username, host, port };
}

function preparePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");
  if (!key.endsWith("\n")) key += "\n";
  return key;
}

export interface SshJobCallbacks {
  onChunk: (chunk: string) => void | Promise<void>;
  onDone: (exitCode: number | null, error?: string) => void | Promise<void>;
}

export function executeSshJob(
  config: SshConfig,
  prompt: string,
  sessionId: string,
  callbacks: SshJobCallbacks
): Promise<void> {
  const shellEscapedPrompt = prompt.replace(/'/g, `'\\''`);
  // sessionId is a generated UUID; passing it to `claude --session-id` makes the
  // resulting session resumable (`claude --resume <sessionId>`) on the remote host.
  const shellEscapedSessionId = sessionId.replace(/'/g, `'\\''`);
  const remoteCmd = `cd ${config.repoPath} && set -a && [ -f .env ] && . ./.env; set +a && export PATH="$HOME/.local/bin:$PATH" && claude --print --dangerously-skip-permissions --session-id '${shellEscapedSessionId}' '${shellEscapedPrompt}'`;

  const { username, host, port } = parseHost(config.host);
  const conn = new Client();

  const connectOpts: Record<string, unknown> = {
    host,
    port,
    username,
    keepaliveInterval: 30000,
  };
  if (config.privateKey) {
    connectOpts.privateKey = preparePrivateKey(config.privateKey);
  }

  return new Promise<void>((resolve) => {
    conn.on("ready", () => {
      conn.exec(remoteCmd, (err, stream) => {
        if (err) {
          void Promise.resolve(callbacks.onDone(null, err.message)).then(() => {
            conn.end();
            resolve();
          });
          return;
        }

        stream.on("data", (d: Buffer) => {
          void callbacks.onChunk(d.toString());
        });
        stream.stderr.on("data", (d: Buffer) => {
          void callbacks.onChunk(d.toString());
        });

        stream.on("close", (code: number | null) => {
          void Promise.resolve(callbacks.onDone(code)).then(() => {
            conn.end();
            resolve();
          });
        });
      });
    });

    conn.on("error", (err) => {
      void Promise.resolve(callbacks.onDone(null, err.message)).then(() =>
        resolve()
      );
    });

    conn.connect(connectOpts as Parameters<Client["connect"]>[0]);
  });
}
