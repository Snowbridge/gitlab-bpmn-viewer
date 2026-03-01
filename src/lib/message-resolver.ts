import { messageMapEntry as diffMME } from "@/content/diff-page";
import { messageMapEntry as blobMME } from "@/content/blob-page";

export class UrlMessageResolver {
    private messageMap: Array<{
        predicate: (url: string) => boolean,
        message: string
    }> = [];

    constructor() {
        this.messageMap.push(diffMME);
        this.messageMap.push(blobMME);
    }

    resolve(url: string): string | undefined {
        return this.messageMap.find(it => it.predicate(url))?.message;
    }
}

/**
 * Usage:
 *  const resolver = new UrlMessageResolver();
 *  const messageId = resolver.resolve("qwe/rty/op");
 */
