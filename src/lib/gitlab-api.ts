/**
 * GitLab API — получение содержимого файлов репозитория
 */

export interface BlobUrlParts {
  /** Путь проекта (например: group/subgroup/project) */
  projectPath: string;
  /** Ветка, тег или коммит */
  ref: string;
  /** Путь к файлу в репозитории */
  filePath: string;
}

/**
 * Парсит URL blob-страницы GitLab и извлекает projectPath, ref, filePath.
 * Маска: любой хост / путь_проекта / - / blob / ref / путь_файла.bpmn
 */
export function parseBlobUrl(url: string): BlobUrlParts | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^\/?(.+?)\/-\/blob\/([^/]+)\/(.+\.bpmn)$/i);
    if (!match) {
      return null;
    }
    const [, projectPath, ref, filePath] = match;
    if (!projectPath || !ref || !filePath) {
      return null;
    }
    return {
      projectPath: projectPath.replace(/^\/+/, ""),
      ref: decodeURIComponent(ref),
      filePath: decodeURIComponent(filePath),
    };
  } catch {
    return null;
  }
}

/**
 * Парсит URL страницы диффов MR и извлекает projectPath и IID merge request.
 * Маска: любой хост / путь_проекта / - / merge_requests / iid / diffs
 */
export function parseMergeRequestDiffsUrl(url: string): {
  projectPath: string;
  mrIid: number;
} | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(
      /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/i
    );
    if (!match) {
      return null;
    }
    const [, projectPath, iidStr] = match;
    if (!projectPath || !iidStr) {
      return null;
    }
    const mrIid = parseInt(iidStr, 10);
    if (Number.isNaN(mrIid)) {
      return null;
    }
    return {
      projectPath: projectPath.replace(/^\/+/, ""),
      mrIid,
    };
  } catch {
    return null;
  }
}

/**
 * Загружает данные merge request через GitLab API v4.
 * GET /projects/:id/merge_requests/:merge_request_iid
 */
export async function fetchMergeRequest(
  origin: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<{ source_branch: string; target_branch: string }> {
  const base = origin.replace(/\/$/, "");
  const projectId = encodeURIComponent(projectPath);
  const url = `${base}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;
  const response = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as {
    source_branch: string;
    target_branch: string;
  };
  return {
    source_branch: data.source_branch,
    target_branch: data.target_branch,
  };
}

/**
 * Загружает сырое содержимое файла через GitLab API v4.
 * GET /projects/:id/repository/files/:file_path/raw?ref=:ref
 */
export async function fetchFileRaw(
  origin: string,
  token: string,
  projectPath: string,
  ref: string,
  filePath: string
): Promise<string> {
  const base = origin.replace(/\/$/, "");
  const projectId = encodeURIComponent(projectPath);
  const encodedFilePath = encodeURIComponent(filePath);
  const url = `${base}/api/v4/projects/${projectId}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitLab API error: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}
