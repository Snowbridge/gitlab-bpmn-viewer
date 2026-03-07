
export async function fetchFileRaw(
  origin: string,
  token: string,
  projectPath: string,
  ref: string,
  filePath: string
): Promise<string> {
  const base = origin.replace(/\/$/, "");
  const url = `${base}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`;
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

interface MergeRequestRefs {
  source: string;
  target: string;
}

export async function getMergeRequestRefs(origin: string, token: string, projectPath: string, mrIid: string): Promise<MergeRequestRefs> {
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

  return {
    source: data.diff_refs?.start_sha ?? data.source_branch,
    target: data.diff_refs?.head_sha ?? data.target_branch,
  }
}