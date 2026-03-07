import { debug } from "@/lib/logger";
import { DeferredMountPointExecutor } from "./deferred-executor";
import { ForegroundConfig } from "@/lib/configuration";
import { fetchFileRaw, getMergeRequestRefs } from "@/lib/gitlab-api";
import { createIconButton, CSS_CLASS_DIAGRAM_BUTTON, openDiagramModalWithContent, showWarning } from "@/lib/html-utils";

const WATCHDOG_FLAG = `gl-bpmn-viewer-is-injected` as const;
const SELECTOR_FILE_ACTIONS
    = `[data-path$='.bpmn'] > * > div.file-actions:not([${WATCHDOG_FLAG}="true"]):not(:has(button.${CSS_CLASS_DIAGRAM_BUTTON}))` as const;

const PATHNAME_REGEXP = new RegExp(`/(.*)/-/merge_requests/(\\d+)/diffs`, 'i');

const config = new ForegroundConfig();
config.load();

// Track for which files (data-path) the button has already been added
// so that there is no more than one button per .bpmn file on the page.
const processedDiffPaths = new Set<string>();
let lastDiffContextKey: string | null = null;

export class DiffPageLogic extends DeferredMountPointExecutor {

    constructor() {
        super("div.diff-files-holder");
    }

    async execute(): Promise<this> {
        const mountPointElement = this.getMountPointElement();
        if (!mountPointElement) {
            debug(`Mount point element is not found`);
            return this;
        }

        void await config.load();

        const url = document.location.href;

        if (!config.isHostConfigured(url)) {
            debug(`Host is not configured`, url);
            return this;
        }

        const unprocessedPanels = document.querySelectorAll(SELECTOR_FILE_ACTIONS);

        if (unprocessedPanels.length == 0) {
            debug(`No unprocessed bpmn diffs found`);
            return this;
        } else
            debug(`Found ${unprocessedPanels.length} unprocessed file actions panels`);

        // Get from/to refs from MR
        const [_, repoPath, mrId] = document.location.pathname.match(PATHNAME_REGEXP) ?? [];

        if (!repoPath) {
            debug(`No repo path found in pathname`);
            return this;
        }

        if (!mrId) {
            debug(`No MR id found in pathname`);
            return this;
        }

        // If the user navigated to another MR or repository in the same tab (SPA navigation),
        // we reset the cache of processed paths so that we can add a button again
        // for the same relative paths but in a different context.
        const contextKey = `${document.location.origin}/${repoPath}/mr/${mrId}`;
        if (lastDiffContextKey !== contextKey) {
            debug(`Diff context changed, resetting processedDiffPaths cache`);
            processedDiffPaths.clear();
            lastDiffContextKey = contextKey;
        }

        this.stopMountPointObserver(); // there will be modifications below that must not trigger reactions

        const origin = document.location.origin;
        const { source, target } = await getMergeRequestRefs(origin, config.getToken(url), repoPath, mrId);

        debug(`Fetched refs from MR`, source, target);

        // Add a button to every panel from unprocessedPanels
        for (const fileActionsPanel of unprocessedPanels) {
            const grandParentElement = fileActionsPanel.parentElement?.parentElement;
            const dataPath = grandParentElement?.getAttribute('data-path')
            if (!grandParentElement || !dataPath){
                debug(`Page structure is corrupt, can't locate a corresponding div with 'data-path' attribute`);
                continue;
            }

            const watchDog = fileActionsPanel.getAttribute(WATCHDOG_FLAG) ?? "false";
            if (watchDog == "true"){
                debug(`Unprocessed panel has a watchdog flag. It probably means that there are more then one mount point observer running in parallel, which is not suppose to happen`);
                continue;
            } 

            debug(`Creating diagram button for ${dataPath}`);

            const diagramBtn = createIconButton(
                "icons/icon16.png",
                "Показать различия"
            );

            diagramBtn.addEventListener("click", () => {
                onDiagramButtonClick(
                    diagramBtn,
                    source,
                    target,
                    dataPath,
                    origin,
                    config.getToken(url),
                    repoPath
                );
            });

            fileActionsPanel.insertBefore(diagramBtn, fileActionsPanel.firstChild);
            fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");
            processedDiffPaths.add(dataPath);
            fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");
            debug(`Button has been inserted in DOM`);
        }

        this.makeMountPointObserver(mountPointElement); // on dynamic loading in large MRs new SELECTOR_FILE_ACTIONS may appear after the execute()
        return this;
    }

}

async function onDiagramButtonClick(
    diagramBtn: HTMLElement, sourceRef: string, targetRef: string,
    filePath: string, origin: string, token: string,
    projectPath: string
) {
    const [sourceResult, targetResult] = await Promise.allSettled([
        fetchFileRaw(origin, token, projectPath, sourceRef, filePath),
        fetchFileRaw(origin, token, projectPath, targetRef, filePath),
    ]);

    [sourceResult, targetResult].forEach(it => {
        if (it.status == "rejected") {
            showWarning(`Не удалось получить версию файла из репозитория\n${it.reason}`);
        }
    })

    if (sourceResult.status == "fulfilled" && targetResult.status == "fulfilled")
        openDiagramModalWithContent(diagramBtn, sourceResult.value, targetResult.value);
}

