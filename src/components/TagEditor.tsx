import { useState, useRef, KeyboardEvent } from "react";
import { X, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const addTag = async () => {
    const tag = inputValue.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || tags.includes(tag)) {
      setInputValue("");
      setIsAdding(false);
      return;
    }
    const newTags = [...tags, tag];
    await saveTags(newTags);
    setInputValue("");
    setIsAdding(false);
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    await saveTags(newTags);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Escape") {
      setInputValue("");
      setIsAdding(false);
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
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder="Add tag…"
            autoFocus
            className="h-6 w-28 rounded-full px-3 py-0 text-xs bg-secondary border-border"
          />
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
