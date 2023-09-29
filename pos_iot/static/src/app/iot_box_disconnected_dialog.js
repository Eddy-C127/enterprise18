/** @odoo-module */

import { Component, xml } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class iotBoxDisconnectedDialog extends Component {
    static components = { Dialog };
    static props = {
        url: String,
    };
    static template = xml`
        <Dialog title="'Network Error'">
            <p>Please check if the IoT Box is still connected.</p>
            <p>If you are on a secure server (HTTPS) check if you accepted the certificate:</p>
            <ul>
                <li>
                    <span>Access your </span>
                    <a t-attf-href="https://{{props.url}}" target="_blank">IoT Box Homepage</a>
                </li>
                <li>Click on Advanced/Show Details/Details/More information</li>
                <li>Click on Proceed to .../Add Exception/Visit this website/Go on to the webpage</li>
                <li>Firefox only: Click on Confirm Security Exception</li>
                <li>Close this window and try again</li>
            </ul>
        </Dialog>
    `;
}
