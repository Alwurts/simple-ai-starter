import type { LanguageModelUsage } from "ai";
import { z } from "zod";

export const aiMetadataSchema = z.object({
  createdAt: z.iso.datetime(),
  status: z.enum(["pending", "success", "error"]),
  modelId: z.string().optional(),
  usage: z.custom<LanguageModelUsage>().optional(),
  responseTime: z.number().optional(),
  summaryText: z.string().optional(),
});

export type AIMetadata = z.infer<typeof aiMetadataSchema>;

export const aiPlanEntrySchema = z.object({
  content: z.string(),
  status: z.enum(["completed", "pending"]).optional(),
});

export const aiPlanDataSchema = z.object({
  entries: z.array(aiPlanEntrySchema),
});

export const aiDataPartSchema = z.object({
  plan: aiPlanDataSchema,
});

export type AIDataPart = z.infer<typeof aiDataPartSchema>;
