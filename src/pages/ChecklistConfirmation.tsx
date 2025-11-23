import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Check, CheckCircle2, FileText, Cloud, Printer, Link2, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { pdf } from '@react-pdf/renderer';
import { Page, Text, View, Document as PDFDocument, StyleSheet } from '@react-pdf/renderer';
import { useState } from "react";

interface ChecklistItem {
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
  completed: boolean;
}

interface ChecklistData {
  title: string;
  items: ChecklistItem[];
}

const ChecklistConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const checklist = location.state?.checklist as ChecklistData | undefined;
  const isSimpleMode = location.state?.simpleMode || false;
  const projectReportId = location.state?.reportId || null;
  const [isSaving, setIsSaving] = useState(false);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(projectReportId);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const handleViewChecklist = () => {
    navigate("/checklist");
  };

  const handlePrintChecklist = () => {
    window.print();
  };

  const handleCreateNew = () => {
    navigate("/checklist");
  };

  const handleDownloadPDF = async () => {
    if (!checklist) {
      toast.error("No checklist to download");
      return;
    }

    try {
      toast.success("Generating PDF...");

      const pdfStyles = StyleSheet.create({
        page: { padding: 40, backgroundColor: '#ffffff' },
        title: { fontSize: 24, marginBottom: 10, fontWeight: 'bold' },
        subtitle: { fontSize: 12, marginBottom: 20, color: '#666666' },
        itemContainer: { marginBottom: 12, paddingLeft: 10 },
        itemText: { fontSize: 12, marginBottom: 4 },
        itemMeta: { fontSize: 10, color: '#666666' },
      });

      const ChecklistPDF = () => (
        <PDFDocument>
          <Page size="A4" style={pdfStyles.page}>
            <Text style={pdfStyles.title}>{checklist.title}</Text>
            <Text style={pdfStyles.subtitle}>
              Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            {checklist.items.map((item, index) => (
              <View key={index} style={pdfStyles.itemContainer}>
                <Text style={pdfStyles.itemText}>
                  {item.completed ? '☑' : '☐'} {item.text}
                </Text>
                <Text style={pdfStyles.itemMeta}>
                  Priority: {item.priority} • Category: {item.category}
                </Text>
              </View>
            ))}
          </Page>
        </PDFDocument>
      );

      const blob = await pdf(<ChecklistPDF />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${checklist.title}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF Downloaded!");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF");
    }
  };

  const handleDownloadWord = async () => {
    if (!checklist) {
      toast.error("No checklist to download");
      return;
    }

    try {
      toast.success("Generating Word Document...");

      const docSections: any[] = [];

      // Header
      docSections.push(
        new Paragraph({
          text: checklist.title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
              size: 18,
              color: "999999",
            }),
          ],
          spacing: { after: 400 },
        })
      );

      // Checklist items
      checklist.items.forEach((item) => {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.completed ? "☑ " : "☐ ",
              }),
              new TextRun({
                text: item.text,
                strike: item.completed,
              }),
              new TextRun({
                text: ` (${item.priority} priority, ${item.category})`,
                size: 18,
                color: "666666",
              }),
            ],
            spacing: { after: 100 },
          })
        );
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docSections,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${checklist.title}_${new Date().toISOString().split('T')[0]}.docx`);

      toast.success("Word Document Downloaded!");
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error("Failed to generate Word document");
    }
  };

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleLinkToProject = async (selectedReportId: string) => {
    setReportId(selectedReportId);
    setShowProjectSelector(false);
    await saveChecklistToCloud(selectedReportId);
  };

  const handleSaveToCloud = async () => {
    if (!checklist) {
      toast.error("No checklist to save");
      return;
    }

    // If in Simple Mode and no report selected, show project selector
    if (isSimpleMode && !reportId) {
      await fetchProjects();
      setShowProjectSelector(true);
      return;
    }

    // If in Project Mode or report is already selected, save directly
    await saveChecklistToCloud(reportId);
  };

  const saveChecklistToCloud = async (targetReportId: string | null) => {
    if (!checklist) return;

    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save to cloud");
        return;
      }

      toast.success("Saving to cloud...");

      // Step 1: Create a report if we don't have one (Simple Mode standalone)
      let currentReportId = targetReportId;
      if (!currentReportId) {
        const { data: newReport, error: reportError } = await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            project_name: checklist.title,
            customer_name: 'Standalone Checklist',
            job_number: `CL-${Date.now()}`,
            job_description: `Checklist: ${checklist.title}`
          })
          .select()
          .single();

        if (reportError) {
          console.error("Error creating report:", reportError);
          toast.error("Failed to create report");
          return;
        }

        currentReportId = newReport.id;
        setReportId(currentReportId);
      }

      // Step 2: Save checklist to database if not already saved
      let currentChecklistId = checklistId;
      if (!currentChecklistId) {
        const { data: newChecklist, error: checklistError } = await supabase
          .from('checklists')
          .insert({
            user_id: user.id,
            report_id: currentReportId!,
            title: checklist.title
          })
          .select()
          .single();

        if (checklistError) {
          console.error("Error creating checklist:", checklistError);
          toast.error("Failed to save checklist");
          return;
        }

        currentChecklistId = newChecklist.id;
        setChecklistId(currentChecklistId);

        // Step 3: Save checklist items
        const itemsToInsert = checklist.items.map(item => ({
          checklist_id: currentChecklistId!,
          text: item.text,
          priority: item.priority,
          category: item.category,
          completed: item.completed
        }));

        const { error: itemsError } = await supabase
          .from('checklist_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error("Error saving checklist items:", itemsError);
          toast.error("Failed to save checklist items");
          return;
        }
      }

      // Step 4: Generate PDF and save to storage
      const pdfStyles = StyleSheet.create({
        page: { padding: 40, backgroundColor: '#ffffff' },
        title: { fontSize: 24, marginBottom: 10, fontWeight: 'bold' },
        subtitle: { fontSize: 12, marginBottom: 20, color: '#666666' },
        itemContainer: { marginBottom: 12, paddingLeft: 10 },
        itemText: { fontSize: 12, marginBottom: 4 },
        itemMeta: { fontSize: 10, color: '#666666' },
      });

      const ChecklistPDF = () => (
        <PDFDocument>
          <Page size="A4" style={pdfStyles.page}>
            <Text style={pdfStyles.title}>{checklist.title}</Text>
            <Text style={pdfStyles.subtitle}>
              Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            {checklist.items.map((item, index) => (
              <View key={index} style={pdfStyles.itemContainer}>
                <Text style={pdfStyles.itemText}>
                  {item.completed ? '☑' : '☐'} {item.text}
                </Text>
                <Text style={pdfStyles.itemMeta}>
                  Priority: {item.priority} • Category: {item.category}
                </Text>
              </View>
            ))}
          </Page>
        </PDFDocument>
      );

      const blob = await pdf(<ChecklistPDF />).toBlob();

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${checklist.title}_${timestamp}.pdf`;
      const filePath = `${user.id}/${currentReportId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Save document metadata to database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          report_id: currentReportId!,
          file_path: filePath,
          file_name: fileName,
          mime_type: 'application/pdf',
          file_size: blob.size
        });

      if (dbError) {
        console.error("Database error:", dbError);
        toast.error(`Failed to save document metadata: ${dbError.message}`);
        return;
      }

      toast.success("Checklist saved to cloud successfully!");
    } catch (error) {
      console.error('Error saving to cloud:', error);
      toast.error("Failed to save to cloud");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewProject = () => {
    setShowProjectSelector(false);
    navigate("/new-project", { 
      state: { 
        returnTo: "/checklist-confirmation",
        checklist: checklist 
      } 
    });
  };

  return (
    <div className="dark min-h-screen bg-background pb-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <BackButton />
        <h2 className="flex-1 text-center text-lg font-bold text-foreground">
          Confirmation
        </h2>
        <div className="w-[80px]"></div>
      </div>

      {/* Success Icon and Message */}
      <div className="flex flex-col items-center justify-center px-4 pt-12">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </div>
        <h2 className="text-center text-[28px] font-bold leading-tight tracking-tight text-foreground mb-2">
          Checklist created successfully!
        </h2>
        {checklist && (
          <p className="text-center text-muted-foreground">
            {checklist.items.length} tasks generated with AI
          </p>
        )}
      </div>

      {/* AI Generated Checklist Display */}
      {checklist && (
        <div className="px-4 py-6 max-h-96 overflow-y-auto">
          <h3 className="text-xl font-bold text-white mb-4">{checklist.title}</h3>
          <div className="space-y-3">
            {checklist.items.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border hover:bg-secondary/50 transition-colors"
              >
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium mb-2">{item.text}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                      {item.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 px-4 pb-2 pt-10">
        <Button
          onClick={handleViewChecklist}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          View Checklist
        </Button>
        <Button
          onClick={handlePrintChecklist}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          Print Checklist
        </Button>
        <Button
          onClick={handleCreateNew}
          variant="outline"
          className="h-14 w-full border-2 border-border bg-transparent text-base font-bold text-foreground hover:bg-secondary"
        >
          Create New
        </Button>
      </div>

      {/* Static Bottom Action Bar - Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4 z-20">
        <h3 className="mb-4 text-center text-lg font-semibold text-foreground">Save & Print</h3>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadPDF}
            disabled={!checklist}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <Download className="mr-2 h-5 w-5" />
            Save as PDF
          </Button>
          <Button
            onClick={handleDownloadWord}
            disabled={!checklist}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <FileText className="mr-2 h-5 w-5" />
            Save as Word
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={handleSaveToCloud}
            disabled={!checklist || isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <Cloud className="mr-2 h-5 w-5" />
            {isSaving ? "Saving..." : "Save to Cloud"}
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Button
              onClick={handlePrintChecklist}
              className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105"
            >
              <Printer className="mr-2 h-5 w-5" />
              Print
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-14 items-center justify-center py-6 transition-transform duration-200 hover:scale-105"
              title="Copy Link"
            >
              <Link2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Project Selector Dialog for Simple Mode */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">Link to Project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose an existing project or save as standalone
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {/* Save as Standalone Option */}
            <Button
              onClick={() => {
                setShowProjectSelector(false);
                saveChecklistToCloud(null);
              }}
              variant="outline"
              className="w-full justify-start h-auto p-4"
            >
              <div className="text-left">
                <div className="font-semibold">Save as Standalone</div>
                <div className="text-xs text-muted-foreground">Not linked to any project</div>
              </div>
            </Button>

            {/* Create New Project */}
            <Button
              onClick={handleCreateNewProject}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Button>

            {/* Existing Projects */}
            {projects.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or select existing</span>
                  </div>
                </div>
                
                {projects.map((project) => (
                  <Button
                    key={project.id}
                    onClick={() => handleLinkToProject(project.id)}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-semibold">{project.project_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.customer_name} • {project.job_number}
                      </div>
                    </div>
                  </Button>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ChecklistConfirmation;
