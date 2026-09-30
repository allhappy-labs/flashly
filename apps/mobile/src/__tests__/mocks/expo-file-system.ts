const existingDirectories = new Set<string>();
const fileContents = new Map<string, string>();

type UriPart = string | Readonly<{ uri: string }>;

function joinUri(parts: UriPart[]) {
  return parts
    .map((part) => typeof part === 'string' ? part : part.uri)
    .reduce((uri, part) => (
      uri ? `${uri.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}` : part
    ), '');
}

export class Directory {
  readonly uri: string;

  constructor(...parts: UriPart[]) {
    this.uri = joinUri(parts);
  }

  get exists() {
    return existingDirectories.has(this.uri);
  }

  create() {
    existingDirectories.add(this.uri);
  }

  delete() {
    existingDirectories.delete(this.uri);
    for (const uri of fileContents.keys()) {
      if (uri.startsWith(`${this.uri.replace(/\/+$/, '')}/`)) {
        fileContents.delete(uri);
      }
    }
  }
}

export class File {
  readonly uri: string;

  constructor(...parts: UriPart[]) {
    this.uri = joinUri(parts);
  }

  get exists() {
    return fileContents.has(this.uri);
  }

  get name() {
    return this.uri.split('/').pop() ?? '';
  }

  get size() {
    const content = fileContents.get(this.uri);
    return content ? Math.floor((content.length * 3) / 4) : 0;
  }

  create() {
    fileContents.set(this.uri, '');
  }

  async copy(destination: File) {
    await Promise.resolve();
    const content = fileContents.get(this.uri);
    if (content !== undefined) fileContents.set(destination.uri, content);
  }

  write(content: string | Uint8Array) {
    fileContents.set(this.uri, typeof content === 'string' ? content : String(content));
  }

  async base64() {
    return fileContents.get(this.uri) ?? '';
  }

  delete() {
    fileContents.delete(this.uri);
  }
}

export const Paths = {
  cache: 'file:///cache',
  document: 'file:///tmp',
};
