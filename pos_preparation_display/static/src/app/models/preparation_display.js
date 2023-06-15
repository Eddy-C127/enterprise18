/** @odoo-module **/
import { Reactive } from "@web/core/utils/reactive";
import { Order } from "@pos_preparation_display/app/models/order";
import { Orderline } from "@pos_preparation_display/app/models/orderline";
import { Stage } from "@pos_preparation_display/app/models/stage";
import { Category } from "@pos_preparation_display/app/models/category";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { Product } from "@pos_preparation_display/app/models/product";


// in the furur, maybe just set "filterOrders" as a getter and directly call the function.
export class PreparationDisplay extends Reactive {
    constructor({ categories, orders, stages }, env, preparationDisplayId) {
        super();
        this.setup(...arguments);
    }
    setup(data, env, preparationDisplayId) {
        this.id = preparationDisplayId;
        this.env = env;
        this.showCategoryFilter = true;
        this.orm = env.services.orm;
        this.orders = {};
        this.orderlines = {};
        this.categories = {};
        this.products = {};
        this.stages = new Map(); // We need a Map() and not an object because the order of the elements is important
        this.selectedStageId = 0;
        this.selectedCategories = new Set();
        this.selectedProducts = new Set();
        this.filteredOrders = [];
        this.rawData = {
            categories: data.categories,
            orders: data.orders,
            stages: data.stages,
        };

        this.restoreFilterFromLocalStorage();
        this.processStages();
        this.processCategories();
        this.processOrders();
    }

    filterOrders() {
        const stages = this.stages;
        const selectedCategories = this.selectedCategories;
        const selectedProducts = this.selectedProducts;
        const countedOrders = new Set();
        let ordersToDisplay = [];

        this.stages.forEach((stage) => (stage.orderCount = 0));
        ordersToDisplay = Object.values(this.orders)
            .filter((order) => {
                return order.orderlines.find((orderline) => {
                    // the order must be in selected categories or products (if set) and must be flag as displayed.
                    if (
                        (selectedProducts.has(orderline.productId) ||
                            selectedCategories.has(orderline.productCategoryId) ||
                            (selectedProducts.size === 0 && selectedCategories.size === 0)) &&
                        order.displayed
                    ) {
                        if (!countedOrders.has(order.id)) {
                            this.stages.get(order.stageId).orderCount++;
                            countedOrders.add(order.id);
                        }

                        // second filter, if a stage is selected the order must be in.
                        if (order.stageId !== this.selectedStageId && this.selectedStageId) {
                            return false;
                        }

                        return true;
                    }
                });
            })
            .sort((a, b) => {
                const stageA = stages.get(a.stageId);
                const stageB = stages.get(b.stageId);
                const stageDiff = stageA.sequence - stageB.sequence || stageA.id - stageB.id; // sort by stage

                if (stageDiff) {
                    return stageDiff;
                }

                // within the stage, keep the default order unless the state is done then show most recent first.
                let difference;
                if (stageA.id === this.lastStage.id) {
                    difference =
                        deserializeDateTime(b.lastStageChange).ts -
                        deserializeDateTime(a.lastStageChange).ts;
                } else {
                    difference =
                        deserializeDateTime(a.lastStageChange).ts -
                        deserializeDateTime(b.lastStageChange).ts;
                }

                return difference;
            });

        this.filteredOrders = ordersToDisplay;
    }

    get lastStage() {
        return [...this.stages.values()][this.stages.size - 1];
    }

    get firstStage() {
        return [...this.stages.values()][0];
    }

    selectStage(stageId) {
        this.selectedStageId = stageId;
        this.filterOrders();
    }

    async doneOrders(orders) {
        await this.orm.call(
            "pos_preparation_display.order",
            "done_orders_stage",
            [orders.map((order) => order.id), this.id],
            {}
        );
        this.filterOrders();
    }

    orderNextStage(order) {
        if (order.stageId === this.lastStage.id) {
            return this.firstStage;
        }

        const stages = [...this.stages.values()];
        const currentStagesIdx = stages.findIndex((stage) => stage.id === order.stageId);

        return stages[currentStagesIdx + 1] ?? false;
    }

    async changeOrderStage(order, force = false) {
        const linesVisibility = this.getOrderlinesVisibility(order);

        if (force) {
            if (linesVisibility.visibleTodo === 0 || order.changeStageTimeout) {
                this.resetOrderlineStatus(order, true);
                order.clearChangeTimeout();
                return;
            }

            for (const orderline of linesVisibility.visible) {
                if (force) {
                    orderline.todo = false;
                }
            }
        }

        this.syncOrderlinesStatus(order);
        if (order.changeStageTimeout) {
            order.clearChangeTimeout();
            return;
        }

        const allOrderlineDone = order.orderlines.every((orderline) => !orderline.todo);
        if (allOrderlineDone) {
            let nextStage = this.orderNextStage(order);

            const allOrderlineCancelled = order.orderlines.every(
                (orderline) => orderline.productQuantity - orderline.productCancelled === 0
            );

            if (allOrderlineCancelled) {
                nextStage = this.lastStage;
            }

            order.changeStageTimeout = setTimeout(async () => {
                order.stageId = nextStage.id;
                order.lastStageChange = await this.orm.call(
                    "pos_preparation_display.order",
                    "change_order_stage",
                    [[order.id], order.stageId, this.id],
                    {}
                );

                this.resetOrderlineStatus(order, false, true);
                order.clearChangeTimeout();
                this.filterOrders();
            }, 10000);
        }
    }

    async getOrders() {
        this.rawData.orders = await this.orm.call(
            "pos_preparation_display.order",
            "get_preparation_display_order",
            [[], this.id],
            {}
        );

        this.processOrders();
    }

    processCategories() {
        this.categories = Object.fromEntries(
            this.rawData.categories
                .map((category) => [category.id, new Category(category)])
                .sort((a, b) => a.sequence - b.sequence)
        );
    }

    processStages() {
        this.selectStage(this.rawData.stages[0].id);
        this.stages = new Map(
            this.rawData.stages.map((stage) => [stage.id, new Stage(stage, this)])
        );
    }

    processOrders() {
        this.stages.forEach((stage) => (stage.orders = []));

        for (const index in this.categories) {
            this.categories[index].orderlines = [];
        }

        this.orders = this.rawData.orders.reduce((orders, order) => {
            if (order.stage_id === null) {
                order.stage_id = this.firstStage.id;
            }

            const orderObj = new Order(order);

            orderObj.orderlines = order.orderlines.reduce((orderlines, value) => {
                const orderline = new Orderline(value, orderObj);
                const product = new Product([
                    orderline.productId,
                    orderline.productCategoryId,
                    orderline.productName,
                ]);

                this.products[product.id] = product;
                this.orderlines[orderline.id] = orderline;
                this.categories[orderline.productCategoryId]?.orderlines?.push(orderline);
                this.categories[orderline.productCategoryId]?.productIds?.add(orderline.productId);
                orderlines.push(orderline);

                return orderlines;
            }, []);

            if (orderObj.orderlines.length > 0) {
                orders[order.id] = orderObj;
            }

            return orders;
        }, {});

        this.filterOrders();
        return this.orders;
    }

    wsChangeLinesStatus(linesStatus) {
        for (const status of linesStatus) {
            if (!this.orderlines[status.id]) {
                continue;
            }

            this.orderlines[status.id].todo = status.todo;

            if (status.todo) {
                this.orderlines[status.id].order.clearChangeTimeout();
            }
        }
    }

    wsMoveToNextStage(orderId, stageId, lastStageChange) {
        const order = this.orders[orderId];
        clearTimeout(order.changeStageTimeout);

        order.stageId = stageId;
        order.lastStageChange = lastStageChange;
        this.resetOrderlineStatus(order, false, true);
        this.filterOrders();
    }

    toggleCategory(category) {
        const categoryId = category.id;

        if (this.selectedCategories.has(categoryId)) {
            this.selectedCategories.delete(categoryId);
        } else {
            this.selectedCategories.add(categoryId);

            if (category) {
                category.productIds.forEach((productId) => this.selectedProducts.delete(productId));
            }
        }

        this.filterOrders();
        this.saveFilterToLocalStorage();
    }

    toggleProduct(product) {
        const productId = product.id;
        const category = this.categories[product.categoryId];

        if (this.selectedProducts.has(productId)) {
            this.selectedProducts.delete(productId);
        } else {
            this.selectedProducts.add(productId);

            if (category) {
                this.selectedCategories.delete(category.id);
            }
        }

        this.filterOrders();
        this.saveFilterToLocalStorage();
    }

    async resetOrders() {
        this.orders = {};
        this.rawData.orders = await this.orm.call(
            "pos_preparation_display.display",
            "reset",
            [[this.id]],
            {}
        );
    }

    saveFilterToLocalStorage() {
        const userService = this.env.services.user;
        const localStorageName = `preparation_display_${this.id}.db_${userService.db.name}.user_${userService.userId}`;

        localStorage.setItem(
            localStorageName,
            JSON.stringify({
                products: Array.from(this.selectedProducts),
                categories: Array.from(this.selectedCategories),
            })
        );
    }

    restoreFilterFromLocalStorage() {
        const userService = this.env.services.user;
        const localStorageName = `preparation_display_${this.id}.db_${userService.db.name}.user_${userService.userId}`;
        const localStorageData = JSON.parse(localStorage.getItem(localStorageName));

        if (localStorageData) {
            this.selectedCategories = new Set(localStorageData.categories);
            this.selectedProducts = new Set(localStorageData.products);
        }
    }

    async syncOrderlinesStatus(order) {
        const orderlinesStatus = {};
        const orderlineIds = [];

        for (const orderline of order.orderlines) {
            orderlineIds.push(orderline.id);
            orderlinesStatus[orderline.id] = orderline.todo;
        }

        await this.orm.call(
            "pos_preparation_display.orderline",
            "change_line_status",
            [orderlineIds, orderlinesStatus],
            {}
        );
    }

    resetOrderlineStatus(order, sync = false, all = false) {
        for (const orderline of order.orderlines) {
            if (
                orderline.productQuantity - orderline.productCancelled !== 0 &&
                (this.checkOrderlineVisibility(orderline) || all)
            ) {
                orderline.todo = true;
            }
        }

        if (sync) {
            this.syncOrderlinesStatus(order);
        }
    }

    checkOrderlineVisibility(orderline) {
        return (
            this.selectedCategories.has(orderline.productCategoryId) ||
            this.selectedProducts.has(orderline.productId) ||
            (this.selectedCategories.size === 0 && this.selectedProducts.size === 0)
        );
    }

    getOrderlinesVisibility(order) {
        const orderlines = {
            visible: [],
            visibleTodo: 0,
        };

        for (const orderline of order.orderlines) {
            if (this.checkOrderlineVisibility(orderline)) {
                orderlines.visible.push(orderline);
                orderlines.visibleTodo += orderline.todo ? 1 : 0;
            }
        }

        return orderlines;
    }

    exit() {
        window.location.href = "/web#action=pos_preparation_display.action_preparation_display";
    }
}
