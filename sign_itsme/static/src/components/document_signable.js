/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { SignablePDFIframe } from "@sign/components/sign_request/signable_PDF_iframe";
import { Document } from "@sign/components/sign_request/document_signable";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ItsmeDialog } from "@sign_itsme/dialogs/itsme_dialog";

patch(SignablePDFIframe.prototype, "SignablePDFIframeItsmePatch", {
    postRender() {
        const res = this._super();
        if (this.props.errorMessage) {
            const [errorMessage, title] = processErrorMessage.call(this, this.props.errorMessage);
            this.dialog.add(
                AlertDialog,
                {
                    title: title || this.env._t("Error"),
                    body: errorMessage,
                },
                {
                    onClose: () => {
                        deleteQueryParamFromURL("error_message");
                    },
                }
            );
        }
        if (this.props.showThankYouDialog) {
            this.openThankYouDialog();
        }
        return res;
    },

    async getAuthDialog() {
        const superCall = this._super;
        if (this.props.authMethod === "itsme") {
            const credits = await this.rpc("/itsme/has_itsme_credits");
            if (credits) {
                const [route, params] = await this._getRouteAndParams();
                return {
                    component: ItsmeDialog,
                    props: {
                        route,
                        params,
                        onSuccess: () => {
                            this.openThankYouDialog();
                        },
                    },
                };
            }
        }
        return superCall();
    },
});

patch(Document.prototype, "DocumentItsmePatch", {
    getDataFromHTML() {
        this._super();
        this.showThankYouDialog = Boolean(
            this.props.parent.querySelector("#o_sign_show_thank_you_dialog")
        );
        this.errorMessage = this.props.parent.querySelector("#o_sign_show_error_message")?.value;
    },

    get iframeProps() {
        const props = this._super();
        return {
            ...props,
            showThankYouDialog: this.showThankYouDialog,
            errorMessage: this.errorMessage,
        };
    },
});

function deleteQueryParamFromURL(param) {
    const url = new URL(location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url);
}

/**
 * Processes special errors from the IAP server
 * @param { String } errorMessage
 * @returns { [String, Boolean] } error message, title or false
 */
function processErrorMessage(errorMessage) {
    const defaultTitle = false;
    const errorMap = {
        err_connection_odoo_instance: [
            this.env._t(
                "The itsme® identification data could not be forwarded to Odoo, the signature could not be saved."
            ),
            defaultTitle,
        ],
        access_denied: [
            this.env._t(
                "You have rejected the identification request or took too long to process it. You can try again to finalize your signature."
            ),
            this.env._t("Identification refused"),
        ],
    };
    return errorMap[errorMessage] ? errorMap[errorMessage] : [errorMessage, defaultTitle];
}
