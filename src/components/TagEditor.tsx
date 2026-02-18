import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TagEditorProps {
  projectId: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  readOnly?: boolean;
}

export const TagEditor = ({ projectId, tags, onTagsChange, readOnly = false }: TagEditorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all existing tags from other projects for autocomplete
  useEffect(() => {
    const fetchAllTags = async () => {
      const { data } = await supabase
        .from('reports')
        .select('tags')
        .neq('id', projectId);

      if (data) {
        const tagSet = new Set<string>();
        data.forEach(row => (row.tags ?? []).forEach((t: string) => tagSet.add(t)));
        setAllTags(Array.from(tagSet).sort());
      }
    };
    fetchAllTags();
  }, [projectId]);

  const suggestions = inputValue.trim().length > 0
    ? allTags.filter(t =>
        t.includes(inputValue.trim().toLowerCase()) &&
        !tags.includes(t)
      )
    : [];

  const saveTags = async (newTags: string[]) => {
    const { error } = await supabase
      .from('reports')
      .update({ tags: newTags })
      .eq('id', projectId);

    if (error) {
      toast.error("Failed to save tags");
      return false;
    }
    onTagsChange(newTags);
    return true;
  };

  const addTag = async (value?: string) => {
    const raw = (value ?? inputValue).trim().toLowerCase().replace(/\s+/g, '-');
    if (!raw || tags.includes(raw)) {
      setInputValue("");
      setIsAdding(false);
      setHighlightedIndex(-1);
      return;
    }
    const newTags = [...tags, raw];
    await saveTags(newTags);
    setInputValue("");
    setIsAdding(false);
    setHighlightedIndex(-1);
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    await saveTags(newTags);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Tab" && highlightedIndex >= 0) {
        e.preventDefault();
        addTag(suggestions[highlightedIndex]);
        return;
      }
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addTag(suggestions[highlightedIndex]);
      } else {
        addTag();
      }
    } else if (e.key === "Escape") {
      setInputValue("");
      setIsAdding(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const tagColors = [
    "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "bg-green-500/15 text-green-400 border-green-500/30",
    "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "bg-rose-500/15 text-rose-400 border-rose-500/30",
    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  ];

  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return tagColors[Math.abs(hash) % tagColors.length];
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getTagColor(tag)}`}
        >
          {tag}
          {!readOnly && (
            <button
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        isAdding ? (
          <div className="relative" ref={dropdownRef}>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay so click on suggestion registers first
                setTimeout(() => {
                  setInputValue("");
                  setIsAdding(false);
                  setHighlightedIndex(-1);
                }, 150);
              }}
              placeholder="Add tag…"
              autoFocus
              className="h-6 w-28 rounded-full px-3 py-0 text-xs bg-secondary border-border"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full mt-1 left-0 z-50 min-w-[140px] rounded-xl border border-border/50 bg-popover shadow-lg overflow-hidden">
                {suggestions.slice(0, 8).map((s, i) => (
                  <button
                    key={s}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(s);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      i === highlightedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60 text-foreground"
                    }`}
                  >
                    <span className={`inline-block rounded-full px-2 py-0.5 border text-xs font-medium ${getTagColor(s)}`}>
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </button>
        )
      )}

      {tags.length === 0 && readOnly && (
        <span className="text-xs text-muted-foreground">No tags</span>
      )}
    </div>
  );
};
