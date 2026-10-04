import { createFileRoute } from "@tanstack/react-router";
import { HomeStage } from "@/components/chat/dock/home-stage";

export const Route = createFileRoute("/_protected/_org/")({
  component: HomeStage,
});
