export function extractPropertyKeyword(query: string): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/\b(founded|established|inception|created|started)\b/i, 'inception'],
    [/\b(born|birth)\b/i, 'date of birth'],
    [/\b(die|died|death|passed away)\b/i, 'date of death'],
    [/\b(population|inhabitants)\b/i, 'population'],
    [/\b(area|size)\b/i, 'area'],
    [/\b(height|tall)\b/i, 'height'],
    [/\b(CEO|chief executive)\b/i, 'chief executive officer'],
    [/\b(founder|founded by)\b/i, 'founder'],
    [/\b(headquarters|headquartered|HQ)\b/i, 'headquarters location'],
    [/\b(capital)\b/i, 'capital'],
    [/\b(nationality|citizen)\b/i, 'country of citizenship'],
    [/\b(occupation|profession|job)\b/i, 'occupation'],
  ];

  for (const [pattern, keyword] of patterns) {
    if (pattern.test(query)) {
      return keyword;
    }
  }

  return null;
}

export function extractEntityFromQuery(query: string): string | null {
  const questionWords = /\b(what|when|where|who|which|how)\b/gi;
  const cleaned = query.replace(questionWords, '').trim();

  const propertyPatterns =
    /\b(founded|established|inception|created|started|born|birth|die|died|death|population|inhabitants|area|size|height|tall|CEO|chief executive|founder|founded by|headquarters|headquartered|HQ|capital|nationality|citizen|occupation|profession|job)\b/gi;
  const withoutProperties = cleaned.replace(propertyPatterns, '').trim();

  const withoutQuestionMark = withoutProperties.replace(/\?/g, '').trim();

  const words = withoutQuestionMark.split(/\s+/);
  const filtered = words.filter((word) => word.length > 2);

  if (filtered.length > 0) {
    return filtered.join(' ');
  }

  return null;
}
