import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Trash2, ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  deleted: boolean;
}

const Checklist = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [notes, setNotes] = useState("");

  const addItem = () => {
    if (!newItemText.trim()) {
      toast.error("Please enter item text");
      return;
    }

    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newItemText,
      checked: false,
      deleted: false
    };

    setItems(prev => [...prev, newItem]);
    setNewItemText("");
    toast.success("Item added");
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, deleted: true } : item
    ));
    toast.success("Item deleted");
  };

  const discardAll = () => {
    setItems([]);
    setNotes("");
    setNewItemText("");
    toast.success("All content discarded");
  };

  const generateSummary = () => {
    if (items.filter(item => !item.deleted).length === 0) {
      toast.error("Please add some checklist items first");
      return;
    }
    toast.success("Generating summary...");
    setTimeout(() => {
      navigate("/review-summary");
    }, 1000);
  };

  const activeItems = items.filter(item => !item.deleted);

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Checklist</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-36">
        {/* Project Info Pills */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">Project: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">Customer: ABC Corp</p>
          </div>
        </div>

        {/* Add New Item Section */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Add Item
          </label>
          <div className="flex gap-2">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Enter checklist item..."
              className="flex-1 bg-secondary text-foreground placeholder:text-muted-foreground"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addItem();
                }
              }}
            />
            <Button
              onClick={addItem}
              size="icon"
              className="shrink-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Checklist Items */}
        {activeItems.length > 0 && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-foreground">
              Items ({activeItems.filter(i => i.checked).length}/{activeItems.length} completed)
            </label>
            <div className="space-y-2">
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg bg-secondary p-3"
                >
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteItem(item.id)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes here..."
            className="min-h-[120px] resize-none bg-secondary text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 px-4 py-4 backdrop-blur-sm">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={discardAll}
            className="flex-1"
          >
            Discard All
          </Button>
          <Button
            onClick={generateSummary}
            className="flex-1"
          >
            Generate Summary
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Checklist;
