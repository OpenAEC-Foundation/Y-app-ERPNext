/**
 * NextCloud WebDAV proxy — browse files via API instead of iframe.
 * Credentials loaded from environment variables.
 */

import type { Request, Response } from "express";

interface FileEntry {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
  isDirectory: boolean;
}

/**
 * Parse a WebDAV PROPFIND XML response into FileEntry objects.
 * Uses simple regex parsing since the response structure is predictable.
 */
function parsePropfindXml(xml: string, basePath: string): FileEntry[] {
  const entries: FileEntry[] = [];

  // Split by <d:response> or <D:response> blocks
  const responseBlocks = xml.split(/<(?:d|D):response>/i).slice(1);

  for (const block of responseBlocks) {
    // Extract href
    const hrefMatch = block.match(/<(?:d|D):href>([^<]*)<\/(?:d|D):href>/i);
    if (!hrefMatch) continue;
    const href = decodeURIComponent(hrefMatch[1]);

    // Check if it's a directory (has <d:collection/>)
    const isDirectory = /<(?:d|D):collection\s*\/?>/.test(block);

    // Extract displayname
    const nameMatch = block.match(/<(?:d|D):displayname>([^<]*)<\/(?:d|D):displayname>/i);

    // Extract last modified
    const modMatch = block.match(/<(?:d|D):getlastmodified>([^<]*)<\/(?:d|D):getlastmodified>/i);

    // Extract content length
    const sizeMatch = block.match(/<(?:d|D):getcontentlength>([^<]*)<\/(?:d|D):getcontentlength>/i);

    // Extract content type
    const typeMatch = block.match(/<(?:d|D):getcontenttype>([^<]*)<\/(?:d|D):getcontenttype>/i);

    // Derive a clean path from the href
    // The href looks like /remote.php/dav/files/user/some/path/
    const davIndex = href.indexOf("/remote.php/dav/files/");
    let filePath = "/";
    if (davIndex !== -1) {
      // Extract everything after /remote.php/dav/files/user/
      const afterDav = href.substring(davIndex + "/remote.php/dav/files/".length);
      // Remove the username prefix
      const slashIdx = afterDav.indexOf("/");
      filePath = slashIdx !== -1 ? afterDav.substring(slashIdx) : "/";
    }

    // Remove trailing slash for comparison
    const cleanFilePath = filePath.replace(/\/+$/, "") || "/";
    const cleanBasePath = basePath.replace(/\/+$/, "") || "/";

    // Skip the directory itself (the first response is the queried directory)
    if (cleanFilePath === cleanBasePath) continue;

    // Derive filename from href or displayname
    const pathParts = filePath.replace(/\/+$/, "").split("/");
    const name = nameMatch?.[1] || pathParts[pathParts.length - 1] || "";

    if (!name) continue;

    entries.push({
      name,
      path: filePath.replace(/\/+$/, "") || "/",
      size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
      lastModified: modMatch?.[1] || "",
      contentType: typeMatch?.[1] || (isDirectory ? "directory" : "application/octet-stream"),
      isDirectory,
    });
  }

  // Sort: folders first, then alphabetical by name
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return entries;
}

/** Resolve NextCloud credentials with Chinese-walls priority:
 *  per-request (per-instance) creds first, env-var fallback last.
 *  Reversing this order leaks one instance's credentials onto every other
 *  tab — see the same fix in messenger.ts's resolveNcTalkCreds. */
function resolveNextcloudCreds(req: Request): { ncUrl: string; user: string; pass: string } | null {
  // Per-request creds first
  const ncUrl = (req.query.url as string || "").replace(/\/+$/, "");
  const user = req.query.user as string;
  const pass = req.query.pass as string;
  if (ncUrl && user && pass) return { ncUrl, user, pass };

  // Env-var fallback for single-instance deploys
  const envUrl = process.env.NEXTCLOUD_URL;
  const envUser = process.env.NEXTCLOUD_USER;
  const envPass = process.env.NEXTCLOUD_PASS;
  if (envUrl && envUser && envPass) {
    return {
      ncUrl: envUrl.replace(/\/+$/, ""),
      user: envUser,
      pass: envPass,
    };
  }
  return null;
}

/**
 * GET /api/nextcloud/files?path=/
 * Or legacy: GET /api/nextcloud/files?url=...&user=...&pass=...&path=/
 * Lists files and folders at the given path using WebDAV PROPFIND.
 */
export async function nextcloudListFiles(req: Request, res: Response) {
  const creds = resolveNextcloudCreds(req);
  if (!creds) {
    return res.status(400).json({ error: "Missing NextCloud credentials. Set NEXTCLOUD_URL, NEXTCLOUD_USER, NEXTCLOUD_PASS env vars or pass url/user/pass." });
  }
  const { ncUrl, user, pass } = creds;
  const path = (req.query.path as string) || "/";

  // Build the WebDAV URL
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const encodedPath = cleanPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const davUrl = `${ncUrl}/remote.php/dav/files/${encodeURIComponent(user)}${encodedPath}`;

  try {
    const response = await fetch(davUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        Depth: "1",
        "Content-Type": "application/xml",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `WebDAV error ${response.status}: ${response.statusText}`,
        detail: text.substring(0, 500),
      });
    }

    const xml = await response.text();
    const files = parsePropfindXml(xml, cleanPath);
    res.json({ data: files });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * GET /api/nextcloud/download?path=...
 * Proxies the actual file download through the backend (so credentials stay server-side).
 */
export async function nextcloudDownload(req: Request, res: Response) {
  const creds = resolveNextcloudCreds(req);
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });
  const path = req.query.path as string;
  if (!path) return res.status(400).json({ error: "Missing path parameter" });

  const { ncUrl, user, pass } = creds;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const encodedPath = cleanPath.split("/").map(s => encodeURIComponent(s)).join("/");
  const davUrl = `${ncUrl}/remote.php/dav/files/${encodeURIComponent(user)}${encodedPath}`;

  try {
    const resp = await fetch(davUrl, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
      },
    });
    if (!resp.ok) return res.status(resp.status).json({ error: `Download failed: ${resp.statusText}` });
    const ct = resp.headers.get("content-type") || "application/octet-stream";
    const cl = resp.headers.get("content-length");
    res.setHeader("Content-Type", ct);
    if (cl) res.setHeader("Content-Length", cl);
    // Set filename for download
    const filename = path.split("/").pop() || "download";
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    // Pipe the response body
    const body = await resp.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * POST /api/nextcloud/upload?path=/target/path
 * Uploads a file to NextCloud via WebDAV PUT (body = raw file).
 */
export async function nextcloudUpload(req: Request, res: Response) {
  const creds = resolveNextcloudCreds(req);
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });
  const path = req.query.path as string;
  if (!path) return res.status(400).json({ error: "Missing path parameter" });

  const { ncUrl, user, pass } = creds;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const encodedPath = cleanPath.split("/").map(s => encodeURIComponent(s)).join("/");
  const davUrl = `${ncUrl}/remote.php/dav/files/${encodeURIComponent(user)}${encodedPath}`;

  try {
    const resp = await fetch(davUrl, {
      method: "PUT",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        "Content-Type": req.headers["content-type"] || "application/octet-stream",
      },
      body: req.body,
    });
    if (!resp.ok) return res.status(resp.status).json({ error: `Upload failed: ${resp.statusText}` });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * POST /api/nextcloud/share?path=...
 * Creates a public share link for a file or folder via NextCloud OCS API.
 */
export async function nextcloudCreateShareLink(req: Request, res: Response) {
  const creds = resolveNextcloudCreds(req);
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });
  const path = req.query.path as string;
  if (!path) return res.status(400).json({ error: "Missing path parameter" });

  const { ncUrl, user, pass } = creds;

  try {
    const resp = await fetch(`${ncUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "OCS-APIRequest": "true",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        path,
        shareType: "3", // 3 = public link
        permissions: "1", // 1 = read-only
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Share creation failed: ${resp.statusText}`, detail: text.substring(0, 500) });
    }
    const data = await resp.json();
    const shareUrl = data?.ocs?.data?.url;
    if (!shareUrl) return res.status(500).json({ error: "No share URL returned", data });
    res.json({ url: shareUrl });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * GET /api/nextcloud/download-url?path=...
 * Or legacy: GET /api/nextcloud/download-url?url=...&user=...&path=...
 * Returns the direct WebDAV download URL for a file.
 */
export async function nextcloudDownloadUrl(req: Request, res: Response) {
  const creds = resolveNextcloudCreds(req);
  if (!creds) {
    return res.status(400).json({ error: "Missing NextCloud credentials" });
  }
  const { ncUrl, user } = creds;
  const path = req.query.path as string;

  if (!path) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const encodedPath = cleanPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const downloadUrl = `${ncUrl}/remote.php/dav/files/${encodeURIComponent(user)}${encodedPath}`;

  res.json({ url: downloadUrl });
}
