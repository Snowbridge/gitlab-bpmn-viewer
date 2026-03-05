import { MESSAGE_TYPE_BLOB_CONTENT_INIT, MESSAGE_TYPE_DIFF_CONTENT_INIT } from "@/types/messages";

const REGEX_TO_MESSAGE = [
    {
        regex: /^\/?(.+?)\/-\/blob\/([^/]+)\/(.+\.bpmn)/i,
        message: MESSAGE_TYPE_BLOB_CONTENT_INIT
    },
    {
        regex: /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs/i,
        message: MESSAGE_TYPE_DIFF_CONTENT_INIT
    },
]

export default (url: string) => {
    return REGEX_TO_MESSAGE.find(it => it.regex.test(url))?.message;
}