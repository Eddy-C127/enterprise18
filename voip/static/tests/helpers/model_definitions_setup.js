import {
    addModelNamesToFetch,
    insertModelFields,
    insertRecords,
} from "@bus/../tests/helpers/model_definitions_helpers";

addModelNamesToFetch(["res.users", "voip.call", "voip.provider"]);

insertModelFields("voip.call", {
    direction: { default: "outgoing" },
    state: { default: "calling" },
});
insertModelFields("res.users", {
    voip_provider_id: { default: 1 },
});
insertRecords("voip.provider", [
    {
        id: 1,
        name: "Default",
        mode: "demo",
    },
]);
