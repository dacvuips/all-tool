import AgendaClient from "agenda";
import config from "config";

const agenda = new AgendaClient({
  db: { address: config.get("mongo.main"), collection: "agendaJobs" },
});

export const Agenda = agenda;
