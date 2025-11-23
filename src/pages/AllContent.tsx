import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/BackButton";
import { FileText, ListChecks, StickyNote, Search, Filter, Calendar, Building2, Hash, User as UserIcon, Download } from "lucide-react";
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
import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
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
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "project">("recent");
  const [activeTab, setActiveTab] = useState<"all" | "reports" | "checklists">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [isExporting, setIsExporting] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
            Field Report - {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
            Generated on {new Date(checklist.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
            text: `Field Report - ${new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
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
            text: `Generated on ${new Date(checklist.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
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
          <h1 className="text-lg font-bold text-foreground">All Content</h1>
          <div className="w-[80px]"></div>
        </div>
      </header>

      <main className="p-4 pb-20">
        {/* Export Actions Bar */}
        <div className="mb-4 flex gap-3">
          <Button
            onClick={() => handleExportAll('pdf')}
            disabled={isExporting || filteredContent.length === 0}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export All as PDF"}
          </Button>
          <Button
            onClick={() => handleExportAll('docx')}
            disabled={isExporting || filteredContent.length === 0}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export All as Word"}
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by project, customer, job number..."
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
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Date filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted mb-4">
            <TabsTrigger value="all">
              All ({reports.length + checklists.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Reports ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Checklists ({checklists.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {filteredContent.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    {searchQuery || dateFilter !== "all" 
                      ? "No content matches your filters"
                      : "No content yet. Create your first project to get started!"}
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
                              {item.type === 'report' ? 'Report' : 'Checklist'}
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
                                  <span>{item.item_count || 0} items</span>
                                </div>
                              </>
                            )}
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(item.created_at)}</span>
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
    </div>
  );
};

export default AllContent;
