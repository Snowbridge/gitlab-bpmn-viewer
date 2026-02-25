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

/** Ссылки на коммиты диффа MR (не зависят от удалённых веток). */
export interface MergeRequestDiffRefs {
  /** SHA коммита в target branch (база для диффа). */
  start_sha: string;
  /** SHA коммита в source branch (голова MR). */
  head_sha: string;
}

export interface MergeRequestInfo {
  source_branch: string;
  target_branch: string;
  /** При наличии — используем SHA вместо имён веток (работает и для смерженных MR с удалённой source branch). */
  diff_refs?: MergeRequestDiffRefs;
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
): Promise<MergeRequestInfo> {
  const base = origin.replace(/\/$/, "");
  const url = `${base}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`;
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
    diff_refs?: { base_sha: string; start_sha: string; head_sha: string };
  };
  const result: MergeRequestInfo = {
    source_branch: data.source_branch,
    target_branch: data.target_branch,
  };
  if (data.diff_refs?.start_sha && data.diff_refs?.head_sha) {
    result.diff_refs = {
      start_sha: data.diff_refs.start_sha,
      head_sha: data.diff_refs.head_sha,
    };
  }
  return result;
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
  // Путь проекта в URL не кодируем (слэши остаются сегментами пути). Кодируем только путь к файлу.
  const encodedFilePath = encodeURIComponent(filePath);
  const url = `${base}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(ref)}`;
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
