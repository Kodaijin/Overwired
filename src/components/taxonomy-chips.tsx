import { cn } from "@/lib/utils";

/**
 * Multi-select chips backed by real checkboxes.
 *
 * Native inputs mean the selection is submitted with the form without any
 * client state, and keyboard and screen-reader behaviour comes for free. The
 * chip look is just styling on the label.
 */
export interface ChipOption {
  id: string;
  label: string;
  /** Nesting level, used to indent child locations. */
  depth?: number;
}

export function TaxonomyChips({
  name,
  legend,
  options,
  selectedIds = [],
  emptyMessage = "Nothing to choose from yet - add entries in Settings.",
}: {
  name: string;
  legend: string;
  options: readonly ChipOption[];
  selectedIds?: readonly string[];
  emptyMessage?: string;
}) {
  if (options.length === 0) {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">{legend}</legend>
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </fieldset>
    );
  }

  const selected = new Set(selectedIds);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm leading-none font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "border-border hover:bg-muted has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-primary has-focus-visible:ring-ring cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors select-none has-focus-visible:ring-3",
              option.depth ? "ml-3" : undefined,
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selected.has(option.id)}
              className="sr-only"
            />
            {option.depth ? <span aria-hidden="true">↳ </span> : null}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
