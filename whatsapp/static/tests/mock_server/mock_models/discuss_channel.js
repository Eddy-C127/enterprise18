import { mailModels } from "@mail/../tests/mail_test_helpers";
import { fields, makeKwArgs, serverState } from "@web/../tests/web_test_helpers";
import { serializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

export class DiscussChannel extends mailModels.DiscussChannel {
    whatsapp_channel_valid_until = fields.Datetime({
        default: () => serializeDateTime(DateTime.local().plus({ days: 1 })),
    });

    /**
     * @override
     * @type {typeof mailModels.DiscussChannel["prototype"]["_channel_info"]}
     */
    _channel_info(ids) {
        const channelInfos = super._channel_info(...arguments);
        for (const channelInfo of channelInfos) {
            const [channel] = this._filter([["id", "=", channelInfo.id]]);
            channelInfo.anonymous_name = channel.anonymous_name;
            if (
                channel.channel_type === "whatsapp" &&
                Boolean(channel.whatsapp_channel_valid_until)
            ) {
                channelInfo.whatsapp_channel_valid_until = channel.whatsapp_channel_valid_until;
            }
        }
        return channelInfos;
    }

    /** @param {number[]} ids */
    whatsapp_channel_join_and_pin(ids) {
        /** @type {import("mock_models").DiscussChannelMember} */
        const DiscussChannelMember = this.env["discuss.channel.member"];
        /** @type {import("mock_models").BusBus} */
        const BusBus = this.env["bus.bus"];
        const [channel] = this._filter([["id", "in", ids]]);

        let selfMember = this._find_or_create_member_for_self(channel.id);
        if (selfMember) {
            DiscussChannelMember.write([selfMember.id], {
                unpin_dt: false,
            });
        } else {
            selfMember = DiscussChannelMember.create({
                channel_id: channel.id,
                partner_id: serverState.partnerId,
                create_uid: this.env.uid,
            });
            this.message_post(
                channel.id,
                makeKwArgs({
                    body: "<div class='o_mail_notification'>joined the channel</div>",
                    message_type: "notification",
                    subtype_xmlid: "mail.mt_comment",
                })
            );
            BusBus._sendone(channel, "mail.record/insert", {
                ChannelMember: [DiscussChannelMember._discuss_channel_member_format(selfMember)],
                Thread: [
                    {
                        id: channel.id,
                        memberCount: DiscussChannelMember.search_count([
                            ["channel_id", "=", channel.id],
                        ]),
                        model: "discuss.channel",
                    },
                ],
            });
        }
        return { Thread: this._channel_info([channel.id]) };
    }
    /**
     * @override
     * @type {typeof mailModels.DiscussChannel["prototype"]["_types_allowing_seen_infos"]}
     */
    _types_allowing_seen_infos() {
        return super._types_allowing_seen_infos(...arguments).concat(["whatsapp"]);
    }
}
