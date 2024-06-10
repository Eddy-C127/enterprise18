import { patch } from "@web/core/utils/patch";
import { InstallKiosk } from "@web/webclient/actions/action_install_kiosk_pwa";
import { onWillStart, useState } from "@odoo/owl";
import { TagsList } from "@web/core/tags_list/tags_list";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

/**
 * Client action to use in a dialog to display the URL of a Kiosk, containing a
 * link to Install the corresponding PWA
 */
patch(InstallKiosk.prototype, {
    async setup() {
        super.setup();
        this.state = useState({ tags: [] });
        this.notification = useService("notification");
        onWillStart(async () => {
            const available_iot_box_ids = await this.orm.call(
                "pos.config",
                "get_available_iot_box_ids",
                [this.props.action.context.active_id]
            );
            this.state.tags = available_iot_box_ids.map((iot_box) => {
                return {
                    id: iot_box.id,
                    text: iot_box.name,
                    ip: iot_box.ip,
                    onClick: () => this.actionOpenKioskIot(null, iot_box),
                    onDelete: () => {
                        this.state.tags = this.state.tags.filter((tag) => tag.id !== iot_box.id);
                    },
                };
            });
        });
    },
    async actionOpenKioskIot(_, iotBox = undefined) {
        const iotBoxesToOpen = iotBox ? [iotBox] : this.state.tags;
        const url = new URL(this.url);
        for (const iot of iotBoxesToOpen) {
            try {
                const response = await fetch(`http://${iot.ip}/hw_proxy/customer_facing_display`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        params: {
                            action: "open_kiosk",
                            pos_id: this.props.action.context.active_id,
                            access_token: url.searchParams.get("access_token"),
                        },
                    }),
                    signal: AbortSignal.timeout(5000),
                });

                if (response.ok) {
                    // the fetch will set 'right' as default orientation for the kiosk, we need to update the iot model
                    // to take this into account
                    await this.orm.write("iot.box", [iot.id], { screen_orientation: "right" });
                    this.notification.add(_t("Kiosk successfully opened."), {
                        title: iot.text,
                        type: "success",
                    });
                    this.dialog.closeAll();
                } else {
                    this.notification.add(_t(await response.text()), {
                        title: iot.text,
                        type: "danger",
                    });
                }
            } catch {
                this.notification.add(_t("IoT Box is unreachable.", iot.text), {
                    title: iot.text,
                    type: "danger",
                });
            }
        }
    },
});

patch(InstallKiosk, {
    components: { ...(InstallKiosk.components || {}), TagsList },
});
