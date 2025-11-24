import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Check, CheckCircle2, FileText, Cloud, Printer, Link2, Download, Plus, Loader2, ChevronDown, Link } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { pdf } from '@react-pdf/renderer';
import { Page, Text, View, Document as PDFDocument, StyleSheet } from '@react-pdf/renderer';
import { useState } from "react";
import { formatDateLong } from '@/lib/dateFormat';

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
  const { t } = useTranslation();
  const checklist = location.state?.checklist as ChecklistData | undefined;
  const isSimpleMode = location.state?.simpleMode || false;
  const projectReportId = location.state?.reportId || null;
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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
      toast.error(t('checklistConfirmation.noChecklist'));
      return;
    }

    try {
      toast.success(t('checklistConfirmation.generating'));

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
              {t('checklistConfirmation.generatedOn')} {formatDateLong(new Date())}
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

      toast.success(t('checklistConfirmation.pdfDownloaded'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('checklistConfirmation.failedPDF'));
    }
  };

  const handleDownloadWord = async () => {
    if (!checklist) {
      toast.error(t('checklistConfirmation.noChecklist'));
      return;
    }

    try {
      toast.success(t('checklistConfirmation.generatingWord'));

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
              text: `${t('checklistConfirmation.generatedOn')} ${formatDateLong(new Date())}`,
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

      toast.success(t('checklistConfirmation.wordDownloaded'));
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error(t('checklistConfirmation.failedWord'));
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
      toast.error(t('checklistConfirmation.noChecklistSave'));
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
        toast.error(t('checklistConfirmation.signInRequired'));
        return;
      }

      toast.success(t('checklistConfirmation.savingToCloud'));

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
              {t('checklistConfirmation.generatedOn')} {formatDateLong(new Date())}
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

      toast.success(t('checklistConfirmation.savedToCloud'));
    } catch (error) {
      console.error('Error saving to cloud:', error);
      toast.error(t('checklistConfirmation.failedToSave'));
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
          {t('checklistConfirmation.title')}
        </h2>
        <SettingsButton />
      </div>

      {/* Success Icon and Message */}
      <div className="flex flex-col items-center justify-center px-4 pt-12">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </div>
        <h2 className="text-center text-[28px] font-bold leading-tight tracking-tight text-foreground mb-2">
          {t('checklistConfirmation.success')}
        </h2>
        {checklist && (
          <p className="text-center text-muted-foreground">
            {checklist.items.length} {t('checklistConfirmation.tasksGenerated')}
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
          {t('checklistConfirmation.viewChecklist')}
        </Button>
        <Button
          onClick={handlePrintChecklist}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          {t('checklistConfirmation.printChecklist')}
        </Button>
        <Button
          onClick={handleCreateNew}
          variant="outline"
          className="h-14 w-full border-2 border-border bg-transparent text-base font-bold text-foreground hover:bg-secondary"
        >
          {t('checklistConfirmation.createNew')}
        </Button>
      </div>

      {/* Action Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 z-20">
        {/* Primary Action - Quick Save (Full Width) */}
        <div className="px-4 py-3">
          <Button
            onClick={async () => {
              setIsSaving(true);
              await handleSaveToCloud();
              setShowSuccess(true);
              setTimeout(() => {
                setShowSuccess(false);
                setIsSaving(false);
              }, 2000);
            }}
            variant={showSuccess ? undefined : "default"}
            className={`w-full gap-2 h-12 transition-all ${
              showSuccess 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : ''
            }`}
            disabled={!checklist || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : showSuccess ? (
              <Check className="h-5 w-5 animate-in zoom-in-50 duration-300" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            {isSaving ? t('checklistConfirmation.saving') : showSuccess ? t('checklistConfirmation.quickSave') : t('checklistConfirmation.quickSave')}
          </Button>
        </div>

        {/* Secondary Actions Bar (Centered) */}
        <div className="border-t border-zinc-800 px-4 py-4">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            {/* Print Button */}
            <Button
              onClick={handlePrintChecklist}
              variant="outline"
              size="sm"
              className="gap-2 text-zinc-200 hover:text-white border-zinc-600"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden md:inline">{t('checklistConfirmation.print')}</span>
            </Button>

            {/* Divider */}
            <div className="hidden md:block h-8 w-px bg-zinc-700" />

            {/* Copy Link Button */}
            <Button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success(t('checklistConfirmation.linkCopied'));
              }}
              variant="ghost"
              size="sm"
              className="gap-2 text-zinc-200 hover:text-white"
            >
              <Link className="h-4 w-4" />
              <span className="hidden md:inline">{t('checklistConfirmation.copyLink')}</span>
            </Button>

            {/* Divider */}
            <div className="hidden md:block h-8 w-px bg-zinc-700" />

            {/* Save Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 md:gap-2 text-zinc-200 hover:text-white border-zinc-600"
                  disabled={!checklist}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('checklistConfirmation.saveOptions')}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={handleDownloadPDF} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  {t('checklistConfirmation.savePDF')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadWord} className="gap-2 cursor-pointer">
                  <Download className="h-4 w-4" />
                  {t('checklistConfirmation.saveWord')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Project Selector Dialog for Simple Mode */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('checklistConfirmation.linkToProject')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('checklistConfirmation.chooseExisting')}
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
                <div className="font-semibold">{t('checklistConfirmation.saveStandalone')}</div>
                <div className="text-xs text-muted-foreground">{t('checklistConfirmation.notLinked')}</div>
              </div>
            </Button>

            {/* Create New Project */}
            <Button
              onClick={handleCreateNewProject}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('checklistConfirmation.createNewProject')}
            </Button>

            {/* Existing Projects */}
            {projects.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('checklistConfirmation.orSelectExisting')}</span>
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
