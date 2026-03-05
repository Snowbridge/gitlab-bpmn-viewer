import { debug } from "@/lib/logger";

export abstract class DeferredMountPointExecutor {

    private mountPointObserver?: MutationObserver;

    /**
     * Выполнение привязанной к mountPointSelector бизнес-логики контент-скрипта
     */
    abstract execute(): Promise<this>;

    protected mountPointSelector: string;

    constructor(mountPointSelector: string) {
        this.mountPointSelector = mountPointSelector;
        const element = document.querySelector(this.mountPointSelector);
        if (!element) {
            debug(`Mount point is not found during content script initialization`);
            this.makeBodyObserver(); // ждать, когда появится mount point
        } else {
            debug(`Mount point found during content script initialization`);
            this.execute()
                .then(() => {
                    if (!this.mountPointObserver)
                        this.makeMountPointObserver(element); // после execute() mount point может измениться и может потребоваться повторный запуск execute()
                });
        }
    }

    makeMountPointObserver(mountPointElement: Element) {
        const instanceId = Math.random().toString(36).substring(2, 10);
        debug(`Creating new mount point observer [${instanceId}]`);
        
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this.mountPointObserver = new MutationObserver(async (_, obs: MutationObserver) => {
            const element = document.querySelector(this.mountPointSelector);
            if (element) {
                debug(`Triggering execution in mount point observer [${instanceId}]`);
                void await this.execute();
            }
            else { // элемент был, но пропал
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
        const instanceId = Math.random().toString(36).substring(2, 10);
        debug(`Creating new body observer [${instanceId}]`);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const observer = new MutationObserver(async (_, obs: MutationObserver) => {
            debug(`Searching for mount point in body observer [${instanceId}]`);
            const element = document.querySelector(self.mountPointSelector);
            if (!element)
                return;
            obs.disconnect(); // раз mount point элемент есть, то боди обзёрвер уже не нужен
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
