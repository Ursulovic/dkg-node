import { z } from "zod";
import BiasDetectionReportSchema from "../bias-detector/schema.js";

export const ClaimResearchSchema =
  BiasDetectionReportSchema.shape.factualErrors.element;

export type ClaimResearch = z.infer<typeof ClaimResearchSchema>;

export default ClaimResearchSchema;
