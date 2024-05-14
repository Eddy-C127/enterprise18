import BarcodeModel from "@stock_barcode/models/barcode_model";

import { patch } from "@web/core/utils/patch";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";


patch(BarcodeModel.prototype, {

     /**
     * The purpose of this extension is to allow the user to create the product for the barcode data
     * if no product found based on barcode lookup!
     *
     * @override
     */
    async noProductToast(barcodeData) {
        // Applicable for models ["stock.picking", "stock.quant"]
        // Applicable for the picking operation ["receipts"]
        if (this.isValidForBarcodeLookup) {
            const barcodeVals = await this.orm.call("product.template", "barcode_lookup", [barcodeData.barcode]);
            if (barcodeVals) {
                this.trigger("playSound");
                return await this.action.doAction(
                    "stock_barcode_barcodelookup.product_barcodelookup_action",
                    {
                        additionalContext: {
                            "default_barcode": barcodeData?.barcode,
                            "default_is_storable": true,
                            "dialog_size": "medium",
                        },
                        props: {
                            onSave: async (record) => {
                                this.notification(_t("Product created successfully"), { type: "success" });
                                await this.createNewProductLine(barcodeData);
                                return this.action.doAction({ type: "ir.actions.act_window_close" });
                            },
                        },
                    }
                );
            }
        }
        return super.noProductToast(barcodeData);
    },

    async createNewProductLine(barcodeData) {
        const params = {barcode: barcodeData.barcode, model_name: "product.product"};
        try {
            const result = await rpc("/stock_barcode/get_specific_barcode_data", params);
            if (Object.keys(result).length === 0) {
                const message = _t("No record found for the specified barcode");
                return this.notification(message, {
                    title: _t("Inconsistent Barcode"),
                    type: "danger",
                });
            }
            this.cache.setCache(result);

            // modifying the barcodeData
            const [productRecord] = result["product.product"];
            barcodeData.match = true;
            barcodeData.quantity = 1;
            barcodeData.product = productRecord;
            const fieldsParams = this._convertDataToFieldsParams(barcodeData);
            if (barcodeData.uom) {
                fieldsParams.uom = barcodeData.uom;
            }
            const currentLine = await this.createNewLine({fieldsParams});
            if (currentLine) {
                this._selectLine(currentLine);
            }
            this.trigger("update");
            return true;
        } catch (error) {
            return this.notification(error, {
                title: _t("RPC Error"),
                type: "danger",
            });
        }
    }
});
