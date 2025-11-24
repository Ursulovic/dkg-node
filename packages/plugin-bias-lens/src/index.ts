import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { registerTopicResearcher } from "./registerTopicResearcher";
import { registerBiasDetector } from "./registerBiasDetector";
import { registerPremiumAccess } from "./registerPremiumAccess";

export default defineDkgPlugin((...args) => {
  registerTopicResearcher(...args);
  registerBiasDetector(...args);
  registerPremiumAccess(...args);
});
