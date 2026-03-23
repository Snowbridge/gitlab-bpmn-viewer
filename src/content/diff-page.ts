import { Logger } from "@/lib/logger";
import { DeferredMountPointExecutor } from "./deferred-executor";
import { BaseConfig } from "@/lib/configuration";
import { MergeRequestRefs, fetchFileRaw, getMergeRequestRefs } from "@/lib/gitlab-api";
import { createIconButton, CSS_CLASS_DIAGRAM_BUTTON, openDiagramModalWithContent, showWarning } from "@/lib/html-utils";

const WATCHDOG_FLAG = `gl-bpmn-viewer-is-injected` as const;
const SELECTOR_FILE_ACTIONS
    = `[data-path$='.bpmn'] > * > div.file-actions:not([${WATCHDOG_FLAG}="true"]):not(:has(button.${CSS_CLASS_DIAGRAM_BUTTON}))` as const;

const PATHNAME_REGEXP = new RegExp(`/(.*)/-/merge_requests/(\\d+)/diffs`, 'i');


// Track for which files (data-path) the button has already been added
// so that there is no more than one button per .bpmn file on the page.
const processedDiffPaths = new Set<string>();
let lastDiffContextKey: string | null = null;

export class DiffPageLogic extends DeferredMountPointExecutor {
  
    constructor(config: BaseConfig, logger: Logger) {
        super("div.diff-files-holder", config, logger);
        this.config = config;
    }

    async execute(): Promise<this> {
        const mountPointElement = this.getMountPointElement();
        if (!mountPointElement) {
            this.logger.debug(`Mount point element is not found`);
            return this;
        }

        void await this.config.load();

        const url = document.location.href;

        if (!this.config.isHostConfigured(url)) {
            this.logger.debug(`Host is not configured`, url);
            return this;
        }

        const unprocessedPanels = document.querySelectorAll(SELECTOR_FILE_ACTIONS);

        if (unprocessedPanels.length == 0) {
            this.logger.debug(`No unprocessed bpmn diffs found`);
            return this;
        } else
        this.logger.debug(`Found ${unprocessedPanels.length} unprocessed file actions panels`);

        // Get from/to refs from MR
        const [_, repoPath, mrId] = document.location.pathname.match(PATHNAME_REGEXP) ?? [];

        if (!repoPath) {
            this.logger.debug(`No repo path found in pathname`);
            return this;
        }

        if (!mrId) {
            this.logger.debug(`No MR id found in pathname`);
            return this;
        }

        // If the user navigated to another MR or repository in the same tab (SPA navigation),
        // we reset the cache of processed paths so that we can add a button again
        // for the same relative paths but in a different context.
        const contextKey = `${document.location.origin}/${repoPath}/mr/${mrId}`;
        if (lastDiffContextKey !== contextKey) {
            this.logger.debug(`Diff context changed, resetting processedDiffPaths cache`);
            processedDiffPaths.clear();
            lastDiffContextKey = contextKey;
        }

        this.stopMountPointObserver(); // there will be modifications below that must not trigger reactions

        const origin = document.location.origin;
        const mrRefs = await getMergeRequestRefs(origin, this.config.getToken(url), repoPath, mrId);

        this.logger.debug(`Fetched refs from MR`, mrRefs);

        // Add a button to every panel from unprocessedPanels
        for (const fileActionsPanel of unprocessedPanels) {
            const grandParentElement = fileActionsPanel.parentElement?.parentElement;
            const dataPath = grandParentElement?.getAttribute('data-path')
            if (!grandParentElement || !dataPath){
                this.logger.debug(`Page structure is corrupt, can't locate a corresponding div with 'data-path' attribute`);
                continue;
            }

            const watchDog = fileActionsPanel.getAttribute(WATCHDOG_FLAG) ?? "false";
            if (watchDog == "true"){
                this.logger.debug(`Unprocessed panel has a watchdog flag. It probably means that there are more then one mount point observer running in parallel, which is not suppose to happen`);
                continue;
            } 

            this.logger.debug(`Creating diagram button for ${dataPath}`);

            const diagramBtn = createIconButton(
                "icons/icon16.png",
                "Показать различия"
            );

            diagramBtn.addEventListener("click", () => {
                onDiagramButtonClick(
                    diagramBtn,
                    mrRefs,
                    dataPath,
                    origin,
                    this.config.getToken(url),
                    repoPath
                );
            });

            fileActionsPanel.insertBefore(diagramBtn, fileActionsPanel.firstChild);
            fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");
            processedDiffPaths.add(dataPath);
            fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");
            this.logger.debug(`Button has been inserted in DOM`);
        }

        this.makeMountPointObserver(mountPointElement); // on dynamic loading in large MRs new SELECTOR_FILE_ACTIONS may appear after the execute()
        return this;
    }

}

async function onDiagramButtonClick(
    diagramBtn: HTMLElement, mrRefs: MergeRequestRefs,
    filePath: string, origin: string, token: string,
    projectPath: string
) {
    const [fileVersionHead, fileVersionBase] = await Promise.allSettled([
        fetchFileRaw(origin, token, projectPath, mrRefs.headSha, filePath),
        fetchFileRaw(origin, token, projectPath, mrRefs.baseSha, filePath),
    ]);

    [fileVersionHead, fileVersionBase].forEach(it => {
        if (it.status == "rejected") {
            showWarning(`Не удалось получить версию файла из репозитория\n${it.reason}`);
        }
    })

    if (fileVersionHead.status == "fulfilled" && fileVersionBase.status == "fulfilled")
        openDiagramModalWithContent(diagramBtn, fileVersionHead.value, fileVersionBase.value, mrRefs);
}

