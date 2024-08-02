const mappingRawBarcodeToObject = {};

export class BarcodeObject {
    constructor(rawValue) {
        this.cache = BarcodeObject.cache;
        this.parser = BarcodeObject.parser;
        this.rawValue = rawValue; // Untouched barcode.

        this.nomenclature = undefined; // Nomenclature this barcode uses.
        this.parsedBarcode = undefined; // Barcode's value(s) once it has been parsed.
        this.parsedData = {}; // Fetched data thanks to the barcode parsed value(s).
        this.isParsed = false; // Flag to know if barcode was already parsed.
        this.missingRecords = []; // Keep track of missing records (try to fetch them later.)

        if (this.parser) {
            this.parsedBarcode = this.parser.parse_barcode(this.rawValue);
            if (!Array.isArray(this.parsedBarcode)) {
                // Depending of the nomenclature, the parsed data is either an object,
                // either an array of objects. Convert it into an array in all case.
                this.parsedBarcode = [this.parsedBarcode];
            }
            this.isParsed = Boolean(this.parsedBarcode.length);
        } else {
            console.warn("No parser set !");
        }

        // Adds this instance into the raw barcode/barcode object mapping.
        mappingRawBarcodeToObject[rawValue] = this;
    }

    /**
     * Attach to the barcode record(s) already in the cache.
     * For missing record(s), they need to be fetched afterward.
     */
    async setRecords(options=false) {
        options = options || {
            fetchLater: true,
            onlyInCache: true,
        };
        this.missingRecords = [];
        for (const barcodeData of this.parsedBarcode) {
            const { type, value } = barcodeData;
            if (type === "product") {
                await this.fetchProduct(value, options);
            } else if (type === "lot") {
                await this.fetchTrackingNumber(value, options);
            }
        }
    }

    // Getters
    get hasMissingRecords() {
        return this.isParsed && Boolean(this.missingRecords.length);
    }

    // Fetching methods
    async fetchTrackingNumber(lotBarcode, options) {
        const lot = await this.cache.getRecordByBarcode(lotBarcode, "stock.lot", options);
        if (lot) {
            this.parsedData.lot = lot;
        } else {
            this.missingRecords.push({ type: "lot", lotBarcode });
        }
    }

    async fetchProduct(productBarcode, options) {
        let product = await this.cache.getRecordByBarcode(productBarcode, "product.product", options);
        if (!product) {
            const packaging = await this.cache.getRecordByBarcode(productBarcode, "product.packaging", {
                onlyInCache: true,
            });
            if (packaging) {
                product = this.cache.getRecord("product.product", packaging.product_id, false);
                this.parsedData.packaging = packaging;
                this.parsedData.quantity = packaging.qty;
            }
        }
        if (product) {
            this.parsedData.product = product;
        } else {
            this.missingRecords.push({ type: "product", productBarcode });
        }
    }
}

BarcodeObject.setEnv = (cache, parser) => {
    BarcodeObject.cache = cache;
    BarcodeObject.parser = parser;
}

BarcodeObject.forBarcode = (barcode) => {
    if (mappingRawBarcodeToObject[barcode]) {
        return mappingRawBarcodeToObject[barcode];
    }
    return new BarcodeObject(barcode);
};
