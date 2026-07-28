export type GithubSyncConfig = {
  owner: string;
  repository: string;
  branch: string;
  path: string;
};

export const DEFAULT_GITHUB_SYNC: GithubSyncConfig = {
  owner: "nguyenthu29102001",
  repository: "app-kiem-kho",
  branch: "main",
  path: "data/inventory.json",
};

const apiUrl = (config: GithubSyncConfig) =>
  `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/contents/${config.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const decodeBase64 = (value: string) => {
  const bytes = Uint8Array.from(atob(value.replace(/\n/g, "")), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const headers = (token?: string) => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export async function readGithubFile<T>(
  config: GithubSyncConfig,
  token?: string,
): Promise<{ data: T; sha: string } | null> {
  const response = await fetch(`${apiUrl(config)}?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub trả về lỗi ${response.status}`);
  const file = (await response.json()) as { content: string; sha: string };
  return { data: JSON.parse(decodeBase64(file.content)) as T, sha: file.sha };
}

export async function writeGithubFile<T>(
  config: GithubSyncConfig,
  token: string,
  data: T,
  knownSha?: string,
  allowRetry = true,
) {
  let sha = knownSha;
  if (!sha) sha = (await readGithubFile<T>(config, token))?.sha;

  const response = await fetch(apiUrl(config), {
    method: "PUT",
    headers: {
      ...headers(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Đồng bộ phiên kiểm kho ${new Date().toLocaleString("vi-VN")}`,
      content: encodeBase64(`${JSON.stringify(data, null, 2)}\n`),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok) {
    if (response.status === 409 && allowRetry) {
      const latest = await readGithubFile<T>(config, token);
      return writeGithubFile(config, token, data, latest?.sha, false);
    }
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `GitHub trả về lỗi ${response.status}`);
  }
  const result = (await response.json()) as { content: { sha: string } };
  return result.content.sha;
}
