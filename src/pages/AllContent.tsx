import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { FileText, ListChecks, StickyNote, Search, Filter, Calendar, Building2, Hash, User as UserIcon, Download, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import { formatDate, formatDateLong } from '@/lib/dateFormat';
import { Document as PDFDocument, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { saveAs } from 'file-saver';

interface Report {
  id: string;
  project_name: string;
  customer_name: string;
  job_number: string;
  job_description: string;
  created_at: string;
  type: 'report';
}

interface Checklist {
  id: string;
  title: string;
  created_at: string;
  report_id: string;
  report?: {
    project_name: string;
    customer_name: string;
    job_number: string;
  };
  type: 'checklist';
  item_count?: number;
}

type ContentItem = Report | Checklist;

const AllContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "project">("recent");
  const [activeTab, setActiveTab] = useState<"all" | "reports" | "checklists">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipientEmail: "",
    recipientName: "",
    subject: "",
    message: "",
  });
  const [emailFormat, setEmailFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    fetchAllContent();
  }, []);

  const fetchAllContent = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch checklists with report info
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('checklists')
        .select(`
          *,
          report:reports(project_name, customer_name, job_number)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (checklistsError) throw checklistsError;

      // Get item counts for each checklist
      const checklistsWithCounts = await Promise.all(
        (checklistsData || []).map(async (checklist) => {
          const { count } = await supabase
            .from('checklist_items')
            .select('*', { count: 'exact', head: true })
            .eq('checklist_id', checklist.id);

          return {
            ...checklist,
            type: 'checklist' as const,
            item_count: count || 0
          };
        })
      );

      setReports((reportsData || []).map(r => ({ ...r, type: 'report' as const })));
      setChecklists(checklistsWithCounts);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = (dateString: string) => {
    const itemDate = new Date(dateString);
    const now = new Date();
    
    switch (dateFilter) {
      case "today":
        return itemDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= weekAgo;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return itemDate >= monthAgo;
      default:
        return true;
    }
  };

  const getFilteredAndSortedContent = (): ContentItem[] => {
    let items: ContentItem[] = [];

    // Combine based on active tab
    if (activeTab === "all" || activeTab === "reports") {
      items = [...items, ...reports];
    }
    if (activeTab === "all" || activeTab === "checklists") {
      items = [...items, ...checklists];
    }

    // Apply search filter
    items = items.filter((item) => {
      const searchLower = searchQuery.toLowerCase();
      if (item.type === 'report') {
        return (
          item.project_name.toLowerCase().includes(searchLower) ||
          item.customer_name.toLowerCase().includes(searchLower) ||
          item.job_number.toLowerCase().includes(searchLower) ||
          item.job_description.toLowerCase().includes(searchLower)
        );
      } else {
        return (
          item.title.toLowerCase().includes(searchLower) ||
          item.report?.project_name?.toLowerCase().includes(searchLower) ||
          item.report?.customer_name?.toLowerCase().includes(searchLower) ||
          item.report?.job_number?.toLowerCase().includes(searchLower)
        );
      }
    });

    // Apply date filter
    items = items.filter(item => filterByDate(item.created_at));

    // Apply sorting
    items.sort((a, b) => {
      switch (sortBy) {
        case "name":
          const nameA = a.type === 'report' ? a.project_name : a.title;
          const nameB = b.type === 'report' ? b.project_name : b.title;
          return nameA.localeCompare(nameB);
        case "project":
          const projectA = a.type === 'report' ? a.project_name : (a.report?.project_name || '');
          const projectB = b.type === 'report' ? b.project_name : (b.report?.project_name || '');
          return projectA.localeCompare(projectB);
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return items;
  };

  const formatDateDisplay = (dateString: string) => {
    return formatDate(dateString);
  };

  const handleItemClick = (item: ContentItem) => {
    if (item.type === 'report') {
      navigate(`/project/${item.id}`);
    } else {
      // Navigate to checklist view or project detail
      navigate(`/project/${item.report_id}`);
    }
  };

  const filteredContent = getFilteredAndSortedContent();

  const generateReportPDF = async (report: Report) => {
    const pdfStyles = StyleSheet.create({
      page: { padding: 40, backgroundColor: '#ffffff' },
      title: { fontSize: 24, marginBottom: 10, fontWeight: 'bold' },
      subtitle: { fontSize: 14, marginBottom: 20, color: '#666666' },
      section: { marginBottom: 10 },
      text: { fontSize: 12, marginBottom: 5 },
      label: { fontSize: 10, color: '#999999', marginBottom: 3 },
    });

    const ReportPDF = () => (
      <PDFDocument>
        <Page size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.title}>{report.project_name}</Text>
          <Text style={pdfStyles.subtitle}>
            Field Report - {formatDateLong(report.created_at)}
          </Text>
          
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.label}>Customer</Text>
            <Text style={pdfStyles.text}>{report.customer_name}</Text>
          </View>

          <View style={pdfStyles.section}>
            <Text style={pdfStyles.label}>Job Number</Text>
            <Text style={pdfStyles.text}>{report.job_number}</Text>
          </View>

          <View style={pdfStyles.section}>
            <Text style={pdfStyles.label}>Description</Text>
            <Text style={pdfStyles.text}>{report.job_description}</Text>
          </View>
        </Page>
      </PDFDocument>
    );

    return await pdf(<ReportPDF />).toBlob();
  };

  const generateChecklistPDF = async (checklist: Checklist) => {
    // Fetch checklist items
    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklist.id)
      .order('created_at', { ascending: false });

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
            Generated on {formatDateLong(checklist.created_at)}
          </Text>
          {checklist.report && (
            <Text style={pdfStyles.subtitle}>
              Project: {checklist.report.project_name} • {checklist.report.customer_name}
            </Text>
          )}
          {(items || []).map((item, index) => (
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

    return await pdf(<ChecklistPDF />).toBlob();
  };

  const generateReportWord = async (report: Report) => {
    const docSections: any[] = [];

    docSections.push(
      new Paragraph({
        text: report.project_name,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Field Report - ${formatDateLong(report.created_at)}`,
            size: 20,
            color: "666666",
          }),
        ],
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Customer: ",
            bold: true,
          }),
          new TextRun({
            text: report.customer_name,
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Job Number: ",
            bold: true,
          }),
          new TextRun({
            text: report.job_number,
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Description: ",
            bold: true,
          }),
          new TextRun({
            text: report.job_description,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docSections,
        },
      ],
    });

    return await Packer.toBlob(doc);
  };

  const generateChecklistWord = async (checklist: Checklist) => {
    // Fetch checklist items
    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklist.id)
      .order('created_at', { ascending: false });

    const docSections: any[] = [];

    docSections.push(
      new Paragraph({
        text: checklist.title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on ${formatDateLong(checklist.created_at)}`,
            size: 18,
            color: "999999",
          }),
        ],
        spacing: { after: 400 },
      })
    );

    if (checklist.report) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Project: ${checklist.report.project_name} • ${checklist.report.customer_name}`,
              size: 18,
              color: "666666",
            }),
          ],
          spacing: { after: 400 },
        })
      );
    }

    (items || []).forEach((item) => {
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

    return await Packer.toBlob(doc);
  };

  const handleExportAll = async (format: 'pdf' | 'docx') => {
    if (filteredContent.length === 0) {
      toast.error("No content to export");
      return;
    }

    setIsExporting(true);
    toast.success(`Preparing ${format.toUpperCase()} export...`);

    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().split('T')[0];

      // Create separate folders for reports and checklists
      const reportsFolder = zip.folder("reports");
      const checklistsFolder = zip.folder("checklists");

      for (const item of filteredContent) {
        try {
          let blob: Blob;
          let fileName: string;

          if (item.type === 'report') {
            fileName = `${item.project_name.replace(/[^a-z0-9]/gi, '_')}_${item.job_number}.${format}`;
            blob = format === 'pdf' 
              ? await generateReportPDF(item)
              : await generateReportWord(item);
            reportsFolder?.file(fileName, blob);
          } else {
            fileName = `${item.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
            blob = format === 'pdf'
              ? await generateChecklistPDF(item)
              : await generateChecklistWord(item);
            checklistsFolder?.file(fileName, blob);
          }
        } catch (error) {
          console.error(`Error generating document for ${item.type}:`, error);
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `field_reports_export_${timestamp}.zip`);

      toast.success(`Successfully exported ${filteredContent.length} items as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error creating export:', error);
      toast.error("Failed to create export");
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailExport = async () => {
    if (!emailForm.recipientEmail) {
      toast.error("Please enter a recipient email");
      return;
    }

    if (filteredContent.length === 0) {
      toast.error("No content to export");
      return;
    }

    setIsSendingEmail(true);
    toast.success(`Preparing ${emailFormat.toUpperCase()} export for email...`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to send emails");
        return;
      }

      // Get user profile for sender name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_name')
        .eq('id', user.id)
        .single();

      const senderName = profile 
        ? `${profile.first_name} ${profile.last_name}${profile.company_name ? ` (${profile.company_name})` : ''}`
        : 'Field Report AI User';

      // Generate ZIP file
      const zip = new JSZip();
      const timestamp = new Date().toISOString().split('T')[0];
      const reportsFolder = zip.folder("reports");
      const checklistsFolder = zip.folder("checklists");

      for (const item of filteredContent) {
        try {
          let blob: Blob;
          let fileName: string;

          if (item.type === 'report') {
            fileName = `${item.project_name.replace(/[^a-z0-9]/gi, '_')}_${item.job_number}.${emailFormat}`;
            blob = emailFormat === 'pdf' 
              ? await generateReportPDF(item)
              : await generateReportWord(item);
            reportsFolder?.file(fileName, blob);
          } else {
            fileName = `${item.title.replace(/[^a-z0-9]/gi, '_')}.${emailFormat}`;
            blob = emailFormat === 'pdf'
              ? await generateChecklistPDF(item)
              : await generateChecklistWord(item);
            checklistsFolder?.file(fileName, blob);
          }
        } catch (error) {
          console.error(`Error generating document for ${item.type}:`, error);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `field_reports_export_${timestamp}.zip`;
      const zipSize = zipBlob.size;

      const MAX_EMAIL_ATTACHMENT = 25 * 1024 * 1024; // 25MB

      let emailPayload: any = {
        recipientEmail: emailForm.recipientEmail,
        recipientName: emailForm.recipientName || undefined,
        senderName,
        subject: emailForm.subject || `Field Report Export - ${timestamp}`,
        message: emailForm.message || undefined,
        fileSize: zipSize,
        fileName: zipFileName,
      };

      // If file is too large, upload to storage and send download link
      if (zipSize > MAX_EMAIL_ATTACHMENT) {
        toast.success("File is large, uploading to cloud storage...");

        // Convert blob to array buffer for upload
        const arrayBuffer = await zipBlob.arrayBuffer();
        const filePath = `exports/${user.id}/${Date.now()}_${zipFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, arrayBuffer, {
            contentType: 'application/zip',
            upsert: false
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          toast.error("Failed to upload file to storage");
          return;
        }

        // Create a signed URL that expires in 7 days
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

        if (urlError || !signedUrlData) {
          toast.error("Failed to generate download link");
          return;
        }

        emailPayload.downloadUrl = signedUrlData.signedUrl;
        console.log("Using download link for large file");
      } else {
        // Convert blob to base64 for email attachment
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data URL prefix
          };
          reader.readAsDataURL(zipBlob);
        });

        emailPayload.fileData = base64Data;
        console.log("Using email attachment for small file");
      }

      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke('send-export-email', {
        body: emailPayload
      });

      if (error) {
        console.error("Email send error:", error);
        toast.error(`Failed to send email: ${error.message}`);
        return;
      }

      console.log("Email sent:", data);
      toast.success(`Export sent successfully to ${emailForm.recipientEmail}!`);
      setShowEmailDialog(false);
      setEmailForm({
        recipientEmail: "",
        recipientName: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send export email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <BackButton fallbackPath="/dashboard" />
          <h1 className="text-lg font-bold text-foreground">{t('allContent.title')}</h1>
          <SettingsButton />
        </div>
      </header>

      <main className="p-4 pb-20">
        {/* Export Actions Bar */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Button
            onClick={() => handleExportAll('pdf')}
            disabled={isExporting || filteredContent.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('allContent.export')}
          </Button>
          <Button
            onClick={() => handleExportAll('docx')}
            disabled={isExporting || filteredContent.length === 0}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('allContent.exportWord')}
          </Button>
          <Button
            onClick={() => setShowEmailDialog(true)}
            disabled={filteredContent.length === 0}
            variant="outline"
          >
            <Mail className="mr-2 h-4 w-4" />
            {t('allContent.email')}
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('allContent.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-2 gap-3">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('allContent.sortRecent')}</SelectItem>
                <SelectItem value="name">{t('allContent.sortName')}</SelectItem>
                <SelectItem value="project">{t('allContent.sortProject')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Date filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allContent.dateAll')}</SelectItem>
                <SelectItem value="today">{t('allContent.dateToday')}</SelectItem>
                <SelectItem value="week">{t('allContent.dateWeek')}</SelectItem>
                <SelectItem value="month">{t('allContent.dateMonth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted mb-4">
            <TabsTrigger value="all">
              {t('allContent.all')} ({reports.length + checklists.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              {t('allContent.reports')} ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <ListChecks className="h-4 w-4" />
              {t('allContent.checklists')} ({checklists.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {filteredContent.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    {searchQuery || dateFilter !== "all" 
                      ? t('allContent.noMatches')
                      : t('allContent.emptyState')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredContent.map((item) => (
                  <Card
                    key={`${item.type}-${item.id}`}
                    className="bg-card border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${
                          item.type === 'report' ? 'bg-primary/10' : 'bg-accent/10'
                        }`}>
                          {item.type === 'report' ? (
                            <FileText className="h-6 w-6 text-primary" />
                          ) : (
                            <ListChecks className="h-6 w-6 text-accent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">
                              {item.type === 'report' ? item.project_name : item.title}
                            </CardTitle>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.type === 'report' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-accent/20 text-accent'
                            }`}>
                              {item.type === 'report' ? t('allContent.reportBadge') : t('allContent.checklistBadge')}
                            </span>
                          </div>
                          <CardDescription className="space-y-1">
                            {item.type === 'report' ? (
                              <>
                                <div className="flex items-center gap-2 text-xs">
                                  <UserIcon className="h-3 w-3" />
                                  <span>{item.customer_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <Hash className="h-3 w-3" />
                                  <span>{item.job_number}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                {item.report && (
                                  <>
                                    <div className="flex items-center gap-2 text-xs">
                                      <Building2 className="h-3 w-3" />
                                      <span>{item.report.project_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <UserIcon className="h-3 w-3" />
                                      <span>{item.report.customer_name}</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-2 text-xs">
                                  <ListChecks className="h-3 w-3" />
                                  <span>{item.item_count || 0} {t('allContent.items')}</span>
                                </div>
                              </>
                            )}
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDateDisplay(item.created_at)}</span>
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Email Export Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('allContent.emailExportTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('allContent.emailExportDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="recipientEmail" className="text-foreground">{t('allContent.recipientEmail')}</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder={t('allContent.recipientEmailPlaceholder')}
                value={emailForm.recipientEmail}
                onChange={(e) => setEmailForm({ ...emailForm, recipientEmail: e.target.value })}
                className="bg-card border-border"
                required
              />
            </div>

            <div>
              <Label htmlFor="recipientName" className="text-foreground">{t('allContent.recipientName')}</Label>
              <Input
                id="recipientName"
                type="text"
                placeholder={t('allContent.recipientNamePlaceholder')}
                value={emailForm.recipientName}
                onChange={(e) => setEmailForm({ ...emailForm, recipientName: e.target.value })}
                className="bg-card border-border"
              />
            </div>

            <div>
              <Label htmlFor="format" className="text-foreground">{t('allContent.exportFormat')}</Label>
              <Select value={emailFormat} onValueChange={(value: any) => setEmailFormat(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">{t('allContent.wordDocument')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject" className="text-foreground">{t('allContent.subject')}</Label>
              <Input
                id="subject"
                type="text"
                placeholder={t('allContent.subjectPlaceholder')}
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                className="bg-card border-border"
              />
            </div>

            <div>
              <Label htmlFor="message" className="text-foreground">{t('allContent.message')}</Label>
              <Textarea
                id="message"
                placeholder={t('allContent.messagePlaceholder')}
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                className="bg-card border-border min-h-[100px]"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              {t('allContent.exportingItems', { count: filteredContent.length })} 
              {t('allContent.largeFilesNote')}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              disabled={isSendingEmail}
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={handleEmailExport}
              disabled={isSendingEmail || !emailForm.recipientEmail}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSendingEmail ? t('allContent.sending') : t('allContent.sendEmail')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllContent;
