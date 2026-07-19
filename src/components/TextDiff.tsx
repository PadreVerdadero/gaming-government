import { diffWords } from "../../shared/text-diff";

export function TextDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const parts = diffWords(before, after);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (part.type === "same") {
          return (
            <span key={i} className="text-stone">
              {part.text}
            </span>
          );
        }
        if (part.type === "del") {
          return (
            <span
              key={i}
              className="rounded-sm bg-danger/25 text-red-200 line-through decoration-red-300/80"
            >
              {part.text}
            </span>
          );
        }
        return (
          <span key={i} className="rounded-sm bg-emerald-500/20 text-emerald-200">
            {part.text}
          </span>
        );
      })}
    </p>
  );
}
