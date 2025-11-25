import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { reportStore } from "./store/index.js";

const title = "Save Bias Report to DKG";
const name = "save-bias-report";
const description = `Publishes a bias report to the DKG by its IRI.

**When to use:** After running 'detect-bias', when user confirms they want to publish the report.

**Why use this tool:** This tool fetches the report content internally - you don't need to stream the JSON-LD content! Just provide the report IRI.

**Input:**
- reportIri: The report IRI from the detect-bias response (e.g., "https://bias-lens.neuroweb.ai/report/{uuid}")

**What gets published:**
- PUBLIC part: Free to read - summary, bias rating, issue counts (replicated to all DKG nodes)
- PRIVATE part: Paid access via x402 - detailed claim reviews with citations (stored only on your node)

**Flow:**
1. Tool fetches the full knowledge asset from in-memory store using the IRI
2. Tool publishes BOTH public and private parts to DKG as a single knowledge asset
3. Tool updates the store with the returned UAL
4. Returns success message with UAL and DKG Explorer link

**Important:** Use the exact IRI from the detect-bias response. The report must exist in the current session.`;

const inputSchema = {
  reportIri: z
    .string()
    .describe(
      "Report IRI from detect-bias (e.g., https://bias-lens.neuroweb.ai/report/{uuid})",
    ),
};

export const registerSaveBiasReport: DkgPlugin = (ctx, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ reportIri }) => {
      const report = await reportStore.get(reportIri);
      if (!report) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Report not found with IRI: ${reportIri}\n\nPlease verify the IRI. Use 'list-bias-reports' to see available reports.`,
            },
          ],
        };
      }

      if (report.metadata.ual) {
        return {
          content: [
            {
              type: "text",
              text: `Report already published!\n\nUAL: ${report.metadata.ual}\nPublished at: ${report.metadata.publishedAt?.toISOString()}`,
            },
          ],
        };
      }

      try {
        const createAsset = await ctx.dkg.asset.create(report.knowledgeAsset, {
          epochsNum: 2,
          minimumNumberOfFinalizationConfirmations: 3,
          minimumNumberOfNodeReplications: 1,
        });
        const ual = createAsset?.UAL || null;

        if (!ual) {
          throw new Error("DKG returned no UAL");
        }

        const explorerUrl = `https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(ual)}`;
        await reportStore.updateUal(reportIri, ual, explorerUrl);
        return {
          content: [
            {
              type: "text",
              text: `Bias report published successfully!\n\nReport: ${report.metadata.title}\nIRI: ${reportIri}\nUAL: ${ual}\nDKG Explorer: ${explorerUrl}\n\nThe report is now permanently stored on the Decentralized Knowledge Graph.`,
            },
          ],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error publishing to DKG: ${error}\n\nThe report is still saved locally. You can try again.`,
            },
            {
              type: "text",
              text: `Original error ${err}`,
            },
          ],
        };
      }
    },
  );
};
