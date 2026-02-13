import Sendgrid from "@sendgrid/mail";
import config from "config";

const SENDGRID_API_KEY = config.get<string>("sendgrid.apiKey");

Sendgrid.setApiKey(SENDGRID_API_KEY);

export const SendgridClient = Sendgrid;
