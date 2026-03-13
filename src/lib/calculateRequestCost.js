import { getPricingForModel } from "@/lib/localDb.js";
import { calculateCostFromTokens } from "@/shared/constants/pricing.js";

export async function calculateRequestCost(provider, model, tokens) {
  if (!tokens || !provider || !model) return 0;

  try {
    const pricing = await getPricingForModel(provider, model);
    if (!pricing) return 0;
    return calculateCostFromTokens(tokens, pricing);
  } catch (error) {
    console.error("Error calculating request cost:", error);
    return 0;
  }
}
