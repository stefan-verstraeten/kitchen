/**
 * Thin Dropbox HTTP API client (https://www.dropbox.com/developers/documentation/http/documentation).
 * The app uses an "App folder" Dropbox app, so every path is relative to
 * /Apps/<app name>/ in the user's Dropbox.
 */

export interface DropboxFile {
  name: string;
  path: string;
  rev: string;
  serverModified: string;
}

export class DropboxError extends Error {
  constructor(
    readonly status: number,
    readonly summary: string,
  ) {
    super(`Dropbox ${status}: ${summary}`);
  }
  get isNotFound() {
    return this.status === 409 && this.summary.includes('not_found');
  }
  get isConflict() {
    return this.status === 409 && this.summary.includes('conflict');
  }
  get isAuth() {
    return this.status === 401;
  }
}

/** Dropbox-API-Arg must be ASCII: escape everything else as \uXXXX. */
function headerJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export class DropboxClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    // Wrapped so fetch is not called as a method of this object (browsers reject that).
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async call(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
    const token = await this.getAccessToken();
    const res = await this.fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      let summary = res.statusText;
      try {
        const body = await res.text();
        try {
          summary = (JSON.parse(body) as { error_summary?: string }).error_summary ?? body;
        } catch {
          summary = body;
        }
      } catch {
        /* ignore */
      }
      throw new DropboxError(res.status, summary);
    }
    return res;
  }

  private async rpc<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await this.call(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }

  /** All files directly inside `folder`. Returns [] when the folder does not exist yet. */
  async listFolder(folder: string): Promise<DropboxFile[]> {
    type Entry = { '.tag': string; name: string; path_display: string; rev: string; server_modified: string };
    type Page = { entries: Entry[]; cursor: string; has_more: boolean };
    const files: DropboxFile[] = [];
    let page: Page;
    try {
      page = await this.rpc<Page>('files/list_folder', { path: folder, recursive: false, limit: 2000 });
    } catch (e) {
      if (e instanceof DropboxError && e.isNotFound) return [];
      throw e;
    }
    for (;;) {
      for (const e of page.entries) {
        if (e['.tag'] === 'file') files.push({ name: e.name, path: e.path_display, rev: e.rev, serverModified: e.server_modified });
      }
      if (!page.has_more) break;
      page = await this.rpc<Page>('files/list_folder/continue', { cursor: page.cursor });
    }
    return files;
  }

  async download(path: string): Promise<{ text: string; rev: string } | undefined> {
    try {
      const res = await this.call('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { 'Dropbox-API-Arg': headerJson({ path }) },
      });
      const meta = JSON.parse(res.headers.get('dropbox-api-result') ?? '{}') as { rev?: string };
      return { text: await res.text(), rev: meta.rev ?? '' };
    } catch (e) {
      if (e instanceof DropboxError && e.isNotFound) return undefined;
      throw e;
    }
  }

  /**
   * Upload a file. With `rev`, only succeeds if the file is still at that
   * revision (otherwise throws a conflict); without, creates it (or overwrites
   * when `overwrite` is true).
   */
  async upload(path: string, content: string, opts: { rev?: string; overwrite?: boolean } = {}): Promise<DropboxFile> {
    const mode = opts.rev ? { '.tag': 'update', update: opts.rev } : opts.overwrite ? 'overwrite' : 'add';
    const res = await this.call('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': headerJson({ path, mode, autorename: false, mute: true, strict_conflict: true }),
      },
      body: content,
    });
    const e = (await res.json()) as { name: string; path_display: string; rev: string; server_modified: string };
    return { name: e.name, path: e.path_display, rev: e.rev, serverModified: e.server_modified };
  }

  async delete(path: string): Promise<void> {
    try {
      await this.rpc('files/delete_v2', { path });
    } catch (e) {
      if (e instanceof DropboxError && e.isNotFound) return;
      throw e;
    }
  }

  async account(): Promise<{ name: string; email: string }> {
    const a = await this.rpc<{ name: { display_name: string }; email: string }>('users/get_current_account', null);
    return { name: a.name.display_name, email: a.email };
  }
}
