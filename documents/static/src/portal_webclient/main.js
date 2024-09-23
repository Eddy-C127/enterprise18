/** @odoo-module **/
import { startWebClient } from "@web/start";
import { PortalWebclientWebClient } from "./portal_webclient";
import { removeRestricted } from "./remove_restricted";

removeRestricted();
startWebClient(PortalWebclientWebClient);
