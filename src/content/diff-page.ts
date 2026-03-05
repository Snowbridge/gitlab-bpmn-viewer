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

// Отслеживаем, для каких файлов (data-path) уже была добавлена кнопка,
// чтобы на странице было не больше одной кнопки на каждый .bpmn.
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

        // получить from/to рефы из MR'а
        const [_, repoPath, mrId] = document.location.pathname.match(PATHNAME_REGEXP) ?? [];

        if (!repoPath) {
            debug(`No repo path found in pathname`);
            return this;
        }

        if (!mrId) {
            debug(`No MR id found in pathname`);
            return this;
        }

        // Если пользователь перешёл на другой MR или репозиторий в том же табе (SPA-навигация),
        // сбрасываем кэш обработанных путей, чтобы можно было снова добавить кнопку
        // для тех же относительных путей, но в другом контексте.
        const contextKey = `${document.location.origin}/${repoPath}/mr/${mrId}`;
        if (lastDiffContextKey !== contextKey) {
            debug(`Diff context changed, resetting processedDiffPaths cache`);
            processedDiffPaths.clear();
            lastDiffContextKey = contextKey;
        }

        this.stopMountPointObserver(); // дальше будут модификации, на которые нельзя реагировать

        const origin = document.location.origin;
        const { source, target } = await getMergeRequestRefs(origin, config.getToken(url), repoPath, mrId);

        debug(`Fetched refs from MR`, source, target);

        // добавить кнопку на каждую панельку из unprocessedPanels
        for (const fileActionsPanel of unprocessedPanels) {
            const grandParentElement = fileActionsPanel.parentElement?.parentElement;
            const dataPath = grandParentElement?.getAttribute('data-path')
            if (!grandParentElement || !dataPath)
                throw Error(`Page structure is corrupt, can't locate a corresponding div with 'data-path' attribute`);

            // Если для данного data-path кнопка уже была добавлена (например, есть
            // несколько панелей для одного и того же файла), просто помечаем панель
            // как обработанную и пропускаем вставку кнопки. В итоге на странице
            // будет не более одной кнопки на каждый .bpmn.
            if (processedDiffPaths.has(dataPath)) {
                debug(`Diagram button for ${dataPath} already exists, marking panel as processed without adding a new button`);
                fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");
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
            debug(`Button has been inserted in DOM`);
        }
        /*

        this.makeMountPointObserver(mountPointElement); // при динамической подгрузке в больших MR-ах могут появиться новые SELECTOR_FILE_ACTIONS
        */
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

