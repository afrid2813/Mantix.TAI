import Anthropic from '@anthropic-ai/sdk';
try {
  const anthropicClient = new Anthropic({ apiKey: ' ' });
} catch (e) {
  console.log("ANTHROPIC ERROR:", e.message);
}
