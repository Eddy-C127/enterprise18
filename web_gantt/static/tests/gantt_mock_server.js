import { registry } from "@web/core/registry";

function _mockGetGanttData(_, { model, kwargs }) {
    const lazy = !kwargs.limit && !kwargs.offset && kwargs.groupby.length === 1;

    const { groups, length } = this.env[model].web_read_group({
        ...kwargs,
        lazy,
        fields: ["__record_ids:array_agg(id)"],
    });

    const recordIds = [];
    for (const group of groups) {
        recordIds.push(...(group.__record_ids || []));
    }

    const { records } = this.env[model].web_search_read(null, null, null, null, null, null, {
        domain: [["id", "in", recordIds]],
        context: kwargs.context,
        specification: kwargs.read_specification,
    });

    return { groups, length, records };
}

registry.category("mock_rpc").add("get_gantt_data", _mockGetGanttData);
