type Sentiment = "positive" | "negative" | "neutral";

export function getSentiment(message: string): Sentiment {
  const positiveWords = ["good", "great", "excellent", "happy"];
  const negativeWords = ["bad", "poor", "unhappy", "terrible"];

  const lowerMessage = message.toLowerCase();
  if (positiveWords.some((word) => lowerMessage.includes(word))) {
    return "positive";
  }
  if (negativeWords.some((word) => lowerMessage.includes(word))) {
    return "negative";
  }
  return "neutral";
}
