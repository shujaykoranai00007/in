import cron from "node-cron";
import { processAutoAnimeSchedule } from "../services/anime-automation.service.js";
import { processPendingPosts } from "../services/scheduler.service.js";

let running = false;

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await processAutoAnimeSchedule();
      await processPendingPosts();
    } catch (error) {
      console.error("Scheduler execution failed", error);
    } finally {
      running = false;
    }
  });

  console.log("Scheduler started: checks pending posts every minute");
}
