import { debug } from "@/lib/logger";
import { getRandomString } from "@/lib/utils";

export abstract class DeferredMountPointExecutor {

    private mountPointObserver?: MutationObserver;

    /**
     * Execution of business logic of the content script bound to mountPointSelector
     */
    abstract execute(): Promise<this>;

    protected mountPointSelector: string;

    constructor(mountPointSelector: string) {
        this.mountPointSelector = mountPointSelector;
        const element = document.querySelector(this.mountPointSelector);
        if (!element) {
            debug(`Mount point is not found during content script initialization`);
            this.makeBodyObserver(); // wait until the mount point appears
        } else {
            debug(`Mount point found during content script initialization`);
            this.execute()
                .then(() => {
                    if (!this.mountPointObserver)
                        this.makeMountPointObserver(element); // after execute() the mount point may change and a repeated execute() may be needed
                });
        }
    }

    makeMountPointObserver(mountPointElement: Element) {
        const instanceId = getRandomString(8);
        debug(`Creating new mount point observer [${instanceId}]`);
        
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this.mountPointObserver = new MutationObserver(async (_, obs: MutationObserver) => {
            const element = document.querySelector(this.mountPointSelector);
            if (element) {
                debug(`Triggering execution in mount point observer [${instanceId}]`);
                void await this.execute();
            }
            else { // element existed but disappeared
                obs.disconnect();
                debug(`Mount point element observer has disconnected itself [${instanceId}]`);
                self.makeBodyObserver();
            }
        });
        this.mountPointObserver.observe(mountPointElement, {
            childList: true,
            subtree: true
        });
        debug(`Mount point element observer is set up to re-inject logic if something changed in ${this.mountPointSelector} [${instanceId}]`);
    }
    private makeBodyObserver() {
        const instanceId = getRandomString(8);
        debug(`Creating new body observer [${instanceId}]`);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const observer = new MutationObserver(async (_, obs: MutationObserver) => {
            debug(`Searching for mount point in body observer [${instanceId}]`);
            const element = document.querySelector(self.mountPointSelector);
            if (!element)
                return;
            obs.disconnect(); // once the mount point element exists, body observer is no longer needed
            debug(`Mount point found, body element observer is disconnected [${instanceId}]`);
            
            void await self.execute();
            if (!self.mountPointObserver)
                self.makeMountPointObserver(element);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        debug(`Body element observer is set up to wait for [${this.mountPointSelector}] [${instanceId}]`);
    }
    protected getMountPointElement() {
        return document.querySelector(this.mountPointSelector);
    }

    stopMountPointObserver() {
        if (this.mountPointObserver) {
            this.mountPointObserver.disconnect()
            this.mountPointObserver = undefined;
        }
        debug(`Mount point observer stopped`);
    }
}
