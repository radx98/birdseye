export const extractTrailingTcoLinks = (
  input: string | null | undefined,
): {
  body: string;
  trailingLinks: string[];
} => {
  if (!input) {
    return { body: "", trailingLinks: [] };
  }

  const trailingMatch = input.match(/\s*(https:\/\/t\.co\/[^\s]+)\s*$/);
  if (!trailingMatch) {
    return { body: input, trailingLinks: [] };
  }

  const trailingSegment = trailingMatch[0];
  const rawLink = trailingMatch[1] ?? "";
  const sanitizedLink = rawLink.replace(/[)\],.;!?'"\u2019\u201D]+$/, "");
  let normalizedLink: string;

  try {
    const url = new URL(sanitizedLink);
    const isHttps = url.protocol === "https:";
    const isTcoHost = url.hostname.toLowerCase() === "t.co";
    const hasPath = Boolean(url.pathname && url.pathname !== "/" && url.pathname.length > 1);
    if (!isHttps || !isTcoHost || !hasPath) {
      return { body: input, trailingLinks: [] };
    }
    normalizedLink = url.toString();
  } catch {
    return { body: input, trailingLinks: [] };
  }

  const body = input.slice(0, input.length - trailingSegment.length).replace(/[\s\n]+$/, "");

  return { body, trailingLinks: [normalizedLink] };
};
