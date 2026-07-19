export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function proposalTypeLabel(type: string): string {
  switch (type) {
    case "enact":
      return "Enact";
    case "amend":
      return "Amend";
    case "repeal":
      return "Repeal";
    case "transmute":
      return "Transmute";
    default:
      return type;
  }
}
