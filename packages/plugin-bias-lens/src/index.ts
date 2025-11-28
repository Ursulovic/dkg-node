import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { registerAssociateUal } from "./registerAssociateUal";
import { registerBiasDetector } from "./registerBiasDetector";
import { registerDkgQuery } from "./registerDkgQuery";
import { registerGetReport } from "./registerGetReport";
import { registerGetReputation } from "./registerGetReputation";
import { registerListReports } from "./registerListReports";
import { registerSaveBiasReport } from "./registerSaveBiasReport";
import { registerTopicResearcher } from "./registerTopicResearcher";
import { registerVoteOnReport } from "./registerVoteOnReport";

export default defineDkgPlugin((...args) => {
  registerTopicResearcher(...args);
  registerBiasDetector(...args);
  registerSaveBiasReport(...args);
  registerAssociateUal(...args);
  registerListReports(...args);
  registerGetReport(...args);
  registerGetReputation(...args);
  registerVoteOnReport(...args);
  registerDkgQuery(...args);
});
