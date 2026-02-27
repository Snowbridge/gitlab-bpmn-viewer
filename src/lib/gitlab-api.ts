/**
 * GitLab API — получение содержимого файлов репозитория
 */

import { debug } from "@/content/utils";

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
  debug(`Checking if url is a blob-page`, url);
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
    debug(`url is a blob-page`, url);
    return {
      projectPath: projectPath.replace(/^\/+/, ""),
      ref: decodeURIComponent(ref),
      filePath: decodeURIComponent(filePath),
    };
  } catch {
    /* nothing */
  }
  debug(`url is NOT a blob-page`, url);
  return null;
}

/**
 * Парсит URL страницы диффов MR и извлекает projectPath и IID merge request.
 * Маска: любой хост / путь_проекта / - / merge_requests / iid / diffs
 */
export function parseMergeRequestDiffsUrl(url: string): {
  projectPath: string;
  mrIid: number;
} | null {
  debug(`Parsing a merge request page`, url);
  try {
    const u = new URL(url);
    const match = u.pathname.match(
      /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/i
    );
    if (!match) {
      debug(`Url is NOT a merge request page`, url);
      return null;
    }
    const [, projectPath, iidStr] = match;
    if (!projectPath || !iidStr) {
      debug(`Unable to retrieve projectPath and mr id`);
      return null;
    }
    const mrIid = parseInt(iidStr, 10);
    if (Number.isNaN(mrIid)) {
      debug(`Mr id is NaN`);
      return null;
    }
    const mrInfo = {
      projectPath: projectPath.replace(/^\/+/, ""),
      mrIid,
    };
    debug(`Diff-page parsed successfully`, mrInfo);
    return mrInfo;
  } catch {
    /* nothing */
  }
  //debug(`match not found`);
  return null;
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
  debug(`Fetching merge request`, url);

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
  debug(`Start-end refs retrieved successfully`, result);
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
  
  debug(`Fetching raw file`, url);

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
  debug(`Raw file is fetched`, url);
  return response.text();
}
