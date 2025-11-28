import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { registerTopicResearcher } from "./registerTopicResearcher";
import { registerBiasDetector } from "./registerBiasDetector";
import { registerSaveBiasReport } from "./registerSaveBiasReport";
import { registerAssociateUal } from "./registerAssociateUal";
import { registerListReports } from "./registerListReports";
import { registerGetReport } from "./registerGetReport";
import { registerDkgQuery } from "./registerDkgQuery";
import { registerX402Report } from "./registerX402Report";
import { registerX402Client } from "./registerX402Client";

export default defineDkgPlugin((...args) => {
  registerTopicResearcher(...args);
  registerBiasDetector(...args);
  registerSaveBiasReport(...args);
  registerAssociateUal(...args);
  registerListReports(...args);
  registerGetReport(...args);
  registerDkgQuery(...args);
  registerX402Report(...args);
  registerX402Client(...args);
});
