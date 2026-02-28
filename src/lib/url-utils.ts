import { debug } from "@/content/utils";

const REGEX_BLOB_URL = /^\/?(.+?)\/-\/blob\/([^/]+)\/(.+\.bpmn)\?(ref_type=.*)$/i;
const REGEX_DIFF_URL = /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/;

interface BlobUrlParts {
    project:string;
    path:string;
    fileName:string;
    ref:string;
}

export default {
    isBlobPage(url:string):boolean{
        return isUrlMatchesRegex(new URL(url), REGEX_BLOB_URL);
    },
    isDiffPage(url:string):boolean{
        return isUrlMatchesRegex(new URL(url), REGEX_DIFF_URL);
    },
    parseBlobUrl(url:string):BlobUrlParts | null {
        const u = new URL(url);
        const match = u.pathname.match(REGEX_BLOB_URL);
        if(!match){
            debug(`Unable to parse blob-page URL`, url);
            return null;
        }
        return {
            project: match[1],
            path: decodeURIComponent(match[2]),
            fileName: match[3],
            ref: decodeURIComponent(match[4].split('=')[1]),
        }
    },
    parseDiffUrl(url:string):DiffUrlParts | null{
        throw Error("Not implemented")
    },
}

function isUrlMatchesRegex(url:URL, regex: RegExp): boolean{
    try {
        return regex.test(url.pathname)
    } catch {
        return false;
    }
}