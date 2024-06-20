/** @odoo-module **/

export const REINSERT_PIVOT_CHILDREN = (env) =>
    env.model.getters.getOdooPivotIds().map((pivotId, index) => ({
        id: `reinsert_pivot_${env.model.getters.getPivotFormulaId(pivotId)}`,
        name: env.model.getters.getPivotDisplayName(pivotId),
        sequence: index,
        execute: async (env) => {
            const dataSource = env.model.getters.getPivot(pivotId);
            const model = await dataSource.copyModelWithOriginalDomain();
            const table = model.getTableStructure().export();
            const position = env.model.getters.getActivePosition();
            env.model.dispatch("INSERT_ODOO_FIX_PIVOT", {
                position,
                pivotId,
                table,
            });
            env.model.dispatch("REFRESH_PIVOT", { id: pivotId });
        },
    }));
