import { TaskGanttRenderer } from "@project_enterprise/task_gantt_renderer";
import { getFixture, patchDate, patchWithCleanup } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { registry } from "@web/core/registry";
import { SELECTORS } from "@web_gantt/../tests/legacy/helpers";
import { COLORS } from "@web_gantt/gantt_connector";

/**
 * @param {number | "new"} id
 */
function getConnector(id) {
    if (!/^__connector__/.test(id)) {
        id = `__connector__${id}`;
    }
    return getFixture().querySelector([
        `${SELECTORS.cellContainer} ${SELECTORS.connector}[data-connector-id='${id}']`,
    ]);
}

function getConnectorMap(renderer) {
    /**
     * @param {PillId} pillId
     */
    const getIdAndUserIdFromPill = (pillId) => {
        /** @type {[ResId, ResId]} */
        const result = [renderer.pills[pillId]?.record.id || false, false];
        if (result[0]) {
            const pills = renderer.mappingRecordToPillsByRow[result[0]]?.pills;
            if (pills) {
                const pillEntry = Object.entries(pills).find((e) => e[1].id === pillId);
                if (pillEntry) {
                    const [firstGroup] = JSON.parse(pillEntry[0]);
                    if (firstGroup.user_ids?.length) {
                        result[1] = firstGroup.user_ids[0] || false;
                    }
                }
            }
        }
        return result;
    };

    /** @type {Map<ConnectorTaskIds, ConnectorProps>} */
    const connectorMap = new Map();
    for (const connector of Object.values(renderer.connectors)) {
        const { sourcePillId, targetPillId } = renderer.mappingConnectorToPills[connector.id];
        if (!sourcePillId || !targetPillId) {
            continue;
        }
        const key = JSON.stringify([
            ...getIdAndUserIdFromPill(sourcePillId),
            ...getIdAndUserIdFromPill(targetPillId),
        ]);
        connectorMap.set(key, connector);
    }
    return connectorMap;
}

const ganttViewParams = {
    arch: /* xml */ `
        <gantt
            js_class="task_gantt"
            date_start="planned_date_begin"
            date_stop="date_deadline"
            default_scale="month"
            dependency_field="depend_on_ids"
        />`,
    resModel: "project.task",
    type: "gantt",
    async mockRPC(_route, { method }) {
        if (method === "get_all_deadlines") {
            return { milestone_id: [], project_id: [] };
        }
    },
};

export const servicesToDefineInGantt = ["messaging", "mail.store"];
const serviceRegistry = registry.category("services");

/** @type {TaskGanttRenderer} */
let renderer;
/** @type {HTMLElement} */
let target;

QUnit.module("Views > GanttView", (hooks) => {
    hooks.beforeEach(async () => {
        patchDate(2021, 9, 10, 8, 0, 0);
        patchWithCleanup(TaskGanttRenderer.prototype, {
            setup() {
                super.setup(...arguments);
                renderer = this;
            },
        });

        setupViewRegistries();

        target = getFixture();

        for (const service of servicesToDefineInGantt) {
            serviceRegistry.add(service, { start() {} });
        }

        ganttViewParams.serverData = {
            models: {
                "project.task": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        planned_date_begin: { string: "Start Date", type: "datetime" },
                        date_deadline: { string: "Stop Date", type: "datetime" },
                        project_id: {
                            string: "Project",
                            type: "many2one",
                            relation: "project.project",
                        },
                        user_ids: { string: "Assignees", type: "many2many", relation: "res.users" },
                        allow_task_dependencies: {
                            string: "Allow Task Dependencies",
                            type: "boolean",
                            default: true,
                        },
                        depend_on_ids: {
                            string: "Depends on",
                            type: "one2many",
                            relation: "project.task",
                        },
                        display_warning_dependency_in_gantt: {
                            string: "Display warning dependency in Gantt",
                            type: "boolean",
                            default: true,
                        },
                    },
                    records: [
                        {
                            id: 1,
                            name: "Task 1",
                            planned_date_begin: "2021-10-19 06:30:12",
                            date_deadline: "2021-10-19 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [],
                            display_warning_dependency_in_gantt: false,
                        },
                        {
                            id: 2,
                            name: "Task 2",
                            planned_date_begin: "2021-10-18 06:30:12",
                            date_deadline: "2021-10-18 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [1],
                        },
                        {
                            id: 3,
                            name: "Task 3",
                            planned_date_begin: "2021-10-19 06:30:12",
                            date_deadline: "2021-10-19 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [],
                        },
                        {
                            id: 4,
                            name: "Task 4",
                            planned_date_begin: "2021-10-18 06:30:12",
                            date_deadline: "2021-10-18 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [3],
                            display_warning_dependency_in_gantt: false,
                        },
                        {
                            id: 5,
                            name: "Task 5",
                            planned_date_begin: "2021-10-19 06:30:12",
                            date_deadline: "2021-10-19 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [],
                        },
                        {
                            id: 6,
                            name: "Task 6",
                            planned_date_begin: "2021-10-18 06:30:12",
                            date_deadline: "2021-10-18 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [5],
                        },
                        {
                            id: 7,
                            name: "Task 7",
                            planned_date_begin: "2021-10-18 06:30:12",
                            date_deadline: "2021-10-19 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [],
                        },
                        {
                            id: 8,
                            name: "Task 8",
                            planned_date_begin: "2021-10-18 07:29:59",
                            date_deadline: "2021-10-20 07:29:59",
                            project_id: 1,
                            user_ids: [2],
                            depend_on_ids: [7],
                        },
                    ],
                },
                "project.project": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1, name: "Project 1" }],
                },
                "res.users": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [
                        { id: 1, name: "User 1" },
                        { id: 2, name: "User 2" },
                        { id: 3, name: "User 3" },
                        { id: 4, name: "User 4" },
                    ],
                },
            },
        };
    });

    QUnit.module("Task Gantt Dependencies");

    QUnit.test("Connectors are correctly computed and rendered.", async (assert) => {
        assert.expect(14);

        /** @type {Map<ConnectorTaskIds, keyof typeof COLORS>} */
        const testMap = new Map([
            ["[1,2,2,2]", "default"],
            ["[3,2,4,2]", "default"],
            ["[5,2,6,2]", "error"],
            ["[7,2,8,2]", "warning"],
        ]);

        await makeView({ ...ganttViewParams, groupBy: ["user_ids"] });

        const connectorMap = getConnectorMap(renderer);

        for (const [testKey, colorCode] of testMap.entries()) {
            const [masterTaskId, masterTaskUserId, taskId, taskUserId] = JSON.parse(testKey);

            assert.ok(
                connectorMap.has(testKey),
                `There should be a connector between task ${masterTaskId} from group user ${masterTaskUserId} and task ${taskId} from group user ${taskUserId}.`
            );

            const connector = connectorMap.get(testKey);
            const connectorColor = connector.style?.stroke?.color;
            const { color } = COLORS[colorCode];
            if (connectorColor) {
                assert.strictEqual(
                    connectorColor,
                    color,
                    `Connector props style should be "${colorCode}".`
                );
            } else {
                assert.notOk(connectorColor, "Connector props style should be the default one.");
            }

            const connectorStroke = getConnector(connector.id).querySelector(
                SELECTORS.connectorStroke
            );

            assert.hasAttrValue(connectorStroke, "stroke", color);
        }

        assert.strictEqual(testMap.size, connectorMap.size);
        assert.strictEqual(target.querySelectorAll(SELECTORS.connector).length, testMap.size);
    });
});
