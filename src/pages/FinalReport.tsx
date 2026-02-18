import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Building2, Download, Edit2, Save, X, Link2, FileText, Printer, Cloud, Loader2, Check, ChevronDown, Link, Mic, MicOff } from "lucide-react";
import { useVoiceTranscription } from "@/hooks/useVoiceTranscription";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import { pdf } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, Table, TableCell, TableRow, WidthType, BorderStyle, ImageRun, ExternalHyperlink } from 'docx';
import { saveAs } from 'file-saver';
import { formatDate, formatDateLong, formatDateTime } from '@/lib/dateFormat';
import DOMPurify from 'dompurify';
import { PhotoTimestamp } from "@/components/PhotoTimestamp";

interface MediaItem {
  id: string;
  file_path: string;
  file_type: string;
  latitude?: number;
  longitude?: number;
  captured_at?: string;
  location_name?: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  priority: string;
  category: string;
}

interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const FinalReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const reportId = location.state?.reportId;
  const [reportData, setReportData] = useState<any>(location.state?.reportData || null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(!reportData);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Voice transcription for inline editing
  const voiceTranscription = useVoiceTranscription((text: string) => {
    if (editingSection) {
      setEditedContent(prev => ({
        ...prev,
        [editingSection]: prev[editingSection] ? `${prev[editingSection]}\n${text}` : text
      }));
    }
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  // Parallel signed URL generation with 55-minute TTL
  const refreshSignedUrls = async (mediaData: MediaItem[]) => {
    const results = await Promise.all(
      mediaData.map(async (item) => {
        const { data } = await supabase.storage
          .from('media')
          .createSignedUrl(item.file_path, 3300); // 55 min TTL
        return { id: item.id, file_type: item.file_type, url: data?.signedUrl ?? null };
      })
    );
    const urls: Record<string, string> = {};
    const vUrls: Record<string, string> = {};
    for (const r of results) {
      if (!r.url) continue;
      if (r.file_type === 'image') urls[r.id] = r.url;
      else if (r.file_type === 'video') vUrls[r.id] = r.url;
    }
    setMediaUrls(urls);
    setVideoUrls(vUrls);
  };

  // Auto-refresh signed URLs every 50 minutes (before 55-min TTL expires)
  useEffect(() => {
    if (media.length === 0) return;
    const interval = setInterval(() => {
      refreshSignedUrls(media);
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [media]);

  useEffect(() => {
    const loadReportData = async () => {
      if (!reportId) {
        console.error("No reportId found in location state");
        toast({
          title: t('finalReport.noReportFound'),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const { data: report, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (reportError || !report) {
          console.error("Failed to load report:", reportError);
          toast({
            title: t('finalReport.failedToLoad'),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        setReportData(report);

        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: false });

        if (!mediaError && mediaData) {
          setMedia(mediaData);
          
          // Parallelize signed URL generation (TTL: 55 min, refreshed every 50 min)
          await refreshSignedUrls(mediaData);
        }

        const { data: checklistsData, error: checklistsError } = await supabase
          .from('checklists')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: false });

        if (!checklistsError && checklistsData) {
          const checklistsWithItems = await Promise.all(
            checklistsData.map(async (checklist) => {
              const { data: itemsData } = await supabase
                .from('checklist_items')
                .select('*')
                .eq('checklist_id', checklist.id)
                .order('created_at', { ascending: false});

              return {
                ...checklist,
                items: itemsData || []
              };
            })
          );
          setChecklists(checklistsWithItems);
        }

      } catch (error) {
        console.error('Error loading report data:', error);
        toast({
          title: t('finalReport.failedToLoad'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadReportData();
  }, [reportId]);

  const handleDownloadPDF = async () => {
    if (!reportData) {
      toast({
        title: t('finalReport.noReportToDownload'),
        description: t('finalReport.pleaseLoadFirst'),
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: t('finalReport.generatingPDF'),
        description: t('finalReport.preparingPDF'),
      });

      // Use existing signed URLs from state for PDF generation
      const mediaUrlsMap = new Map<string, string>();
      const videoUrlsMap = new Map<string, string>();
      for (const item of media) {
        if (item.file_type === 'image' && mediaUrls[item.id]) {
          mediaUrlsMap.set(item.id, mediaUrls[item.id]);
        } else if (item.file_type === 'video' && videoUrls[item.id]) {
          videoUrlsMap.set(item.id, videoUrls[item.id]);
        }
      }

      const blob = await pdf(
        <ReportPDF
          reportData={reportData}
          media={media}
          checklists={checklists}
          mediaUrls={mediaUrlsMap}
          videoUrls={videoUrlsMap}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportData?.project_name || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: t('finalReport.pdfDownloaded'),
        description: t('finalReport.savedAsPDF'),
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: t('finalReport.failedPDF'),
        description: t('finalReport.tryAgain'),
        variant: "destructive",
      });
    }
  };

  const handleDownloadWord = async () => {
    if (!reportData) {
      toast({
        title: t('finalReport.noReportToDownload'),
        description: t('finalReport.pleaseLoadFirst'),
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: t('finalReport.generatingWord'),
        description: t('finalReport.preparingWord'),
      });

      // Parse report sections
      const text = reportData.job_description || '';
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
      const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
      const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);

      // Helper to strip HTML tags
      const stripHtml = (html: string) => {
        return html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]+>/g, '')
          .trim();
      };

      // Build document sections
      const docSections: any[] = [];

      // Header section
      docSections.push(
        new Paragraph({
          text: reportData.project_name,
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${reportData.customer_name} • Job #${reportData.job_number}`,
              color: "666666",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on ${new Date(reportData.created_at).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}`,
              size: 18,
              color: "999999",
            }),
          ],
          spacing: { after: 400 },
        })
      );

      // Summary section
      if (summaryMatch) {
        docSections.push(
          new Paragraph({
            text: "Summary",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            text: stripHtml(summaryMatch[1].trim()),
            spacing: { after: 300 },
          })
        );
      }

      // Key Points section
      if (keyPointsMatch) {
        docSections.push(
          new Paragraph({
            text: "Key Points",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          })
        );

        const points = stripHtml(keyPointsMatch[1].trim())
          .split('\n')
          .filter(line => line.trim());

        points.forEach(point => {
          docSections.push(
            new Paragraph({
              text: point.replace(/^[•\-*]\s*/, '').trim(),
              bullet: { level: 0 },
              spacing: { after: 100 },
            })
          );
        });

        docSections.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      }

      // Action Items section
      if (actionItemsMatch) {
        docSections.push(
          new Paragraph({
            text: "Action Items",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          })
        );

        const actions = stripHtml(actionItemsMatch[1].trim())
          .split('\n')
          .filter(line => line.trim());

        actions.forEach(action => {
          docSections.push(
            new Paragraph({
              text: action.replace(/^[•\-*]\s*/, '').trim(),
              bullet: { level: 0 },
              spacing: { after: 100 },
            })
          );
        });

        docSections.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      }

      // Project Information section
      docSections.push(
        new Paragraph({
          text: "Project Information",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 },
        })
      );

      const infoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Customer:", bold: true })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: reportData.customer_name })],
                width: { size: 70, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Job Number:", bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ text: reportData.job_number })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Created:", bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ text: formatDate(reportData.created_at) })],
              }),
            ],
          }),
          ...(reportData.tags && reportData.tags.length > 0 ? [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Tags:", bold: true })] })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: reportData.tags.join(', ') })],
                }),
              ],
            }),
          ] : []),
        ],
      });

      docSections.push(infoTable);

      // Photos & Media
      if (media.length > 0) {
        docSections.push(
          new Paragraph({
            text: "Photos & Media",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        // Fetch and embed images
        const imagePromises = media
          .filter(item => item.file_type === 'image')
          .slice(0, 6) // Limit to 6 images to avoid file size issues
          .map(async (item) => {
            try {
              // Use signed URL from state for private bucket access
              const signedUrl = mediaUrls[item.id];
              if (!signedUrl) {
                return { success: false };
              }
              const response = await fetch(signedUrl);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              
              return {
                buffer: Buffer.from(arrayBuffer),
                success: true,
              };
            } catch (error) {
              console.error('Error fetching image:', error);
              return { success: false };
            }
          });

        const imageResults = await Promise.all(imagePromises);
        
        // Add images to document
        for (const result of imageResults) {
          if (result.success && result.buffer) {
            try {
              docSections.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: result.buffer,
                      transformation: {
                        width: 500,
                        height: 375,
                      },
                      type: "png",
                    }),
                  ],
                  spacing: { after: 200 },
                  alignment: AlignmentType.CENTER,
                })
              );
            } catch (error) {
              console.error('Error adding image to document:', error);
            }
          }
        }

        if (media.length > 6) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `+ ${media.length - 6} more photo${media.length - 6 !== 1 ? 's' : ''} not shown`,
                  italics: true,
                }),
              ],
              spacing: { after: 200 },
            })
          );
        }
      }

      // Videos section
      const videoMedia = media.filter(item => item.file_type === 'video');
      if (videoMedia.length > 0) {
        docSections.push(
          new Paragraph({
            text: "Videos Recorded",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        videoMedia.forEach((item, idx) => {
          const videoUrl = videoUrls[item.id];
          const note = (item as any).caption || (item as any).voice_note;
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Video ${idx + 1}`, bold: true }),
                ...(note ? [new TextRun({ text: ` — ${note}` })] : []),
              ],
              spacing: { after: 80 },
            })
          );
          if (videoUrl) {
            docSections.push(
              new Paragraph({
                children: [
                  new ExternalHyperlink({
                    link: videoUrl,
                    children: [
                      new TextRun({
                        text: "▶ View / Download Video",
                        color: "6366f1",
                        underline: {},
                      }),
                    ],
                  }),
                ],
                spacing: { after: 160 },
              })
            );
          } else {
            docSections.push(
              new Paragraph({
                children: [new TextRun({ text: "(Video link not available)", italics: true, color: "999999" })],
                spacing: { after: 160 },
              })
            );
          }
        });
      }

      // Checklists
      if (checklists.length > 0) {
        checklists.forEach((checklist) => {
          docSections.push(
            new Paragraph({
              text: checklist.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );

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
        });
      }

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docSections,
          },
        ],
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${reportData.project_name}_${new Date().toISOString().split('T')[0]}.docx`);

      toast({
        title: t('finalReport.wordDownloaded'),
        description: t('finalReport.savedAsWord'),
      });
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast({
        title: t('finalReport.failedWord'),
        description: t('finalReport.tryAgain'),
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast({
        title: t('finalReport.linkCopied'),
        description: t('finalReport.linkCopiedDesc'),
      });
    } catch (err) {
      toast({
        title: t('finalReport.failedCopyLink'),
        description: t('finalReport.tryAgain'),
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveToCloud = async () => {
    if (!reportData) return;

    try {
      setIsSaving(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: t('finalReport.authRequired'),
          description: t('finalReport.signInToSave'),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t('finalReport.savingToCloud'),
        description: t('finalReport.uploadingReport'),
      });

      // Generate PDF blob
      const reportPDF = (
        <ReportPDF
          reportData={reportData}
          media={media}
          checklists={checklists}
        />
      );
      
      const blob = await pdf(reportPDF).toBlob();
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${reportData.project_name}_${timestamp}.pdf`;
      const filePath = `${user.id}/${reportId}/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        toast({
          title: t('finalReport.uploadFailed'),
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      // Save document metadata to database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          report_id: reportId,
          file_path: filePath,
          file_name: fileName,
          mime_type: 'application/pdf',
          file_size: blob.size
        });

      if (dbError) {
        console.error("Database insert error:", dbError);
        toast({
          title: t('finalReport.saveFailed'),
          description: dbError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t('finalReport.savedToCloud'),
        description: t('finalReport.savedSecurely'),
      });
      
    } catch (error) {
      console.error("Error saving to cloud:", error);
      toast({
        title: t('finalReport.saveFailed'),
        description: t('finalReport.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = () => {
    if (!reportData) {
      toast({
        title: t('finalReport.noReportToShare'),
        description: t('finalReport.pleaseLoadFirst'),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('finalReport.sharingReport'),
      description: t('finalReport.openingShare'),
    });
  };

  const handleForward = () => {
    if (!reportData) {
      toast({
        title: t('finalReport.noReportToForward'),
        description: t('finalReport.pleaseLoadFirst'),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('finalReport.forwardingReport'),
      description: t('finalReport.preparingForward'),
    });
  };

  const getMediaUrl = (itemId: string) => {
    return mediaUrls[itemId] || '';
  };

  const handleEditSection = (sectionKey: string, content: string) => {
    setEditingSection(sectionKey);
    setEditedContent({ ...editedContent, [sectionKey]: content });
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditedContent({});
  };

  const handleSaveSection = async (sectionKey: string) => {
    if (!reportId || !reportData) return;

    setIsSaving(true);
    try {
      const text = reportData.job_description;
      let updatedText = text;

      if (sectionKey === 'summary') {
        updatedText = text.replace(
          /SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i,
          `SUMMARY:\n${editedContent[sectionKey]}\n\n`
        );
      } else if (sectionKey === 'keypoints') {
        updatedText = text.replace(
          /KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i,
          `KEY POINTS:\n${editedContent[sectionKey]}\n\n`
        );
      } else if (sectionKey === 'actions') {
        updatedText = text.replace(
          /ACTION ITEMS:\s*([\s\S]*?)$/i,
          `ACTION ITEMS:\n${editedContent[sectionKey]}`
        );
      }

      const { error } = await supabase
        .from('reports')
        .update({ job_description: updatedText })
        .eq('id', reportId);

      if (error) throw error;

      setReportData({ ...reportData, job_description: updatedText });
      setEditingSection(null);
      setEditedContent({});
      toast({
        title: t('finalReport.sectionUpdated'),
      });
    } catch (error) {
      console.error('Error updating section:', error);
      toast({
        title: t('finalReport.failedToUpdate'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background pb-64">
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{reportData?.project_name || t('finalReport.report')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : !reportData ? (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('finalReport.noReportFound')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('finalReport.couldNotLoad')}
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            {t('finalReport.backToDashboard')}
          </Button>
        </div>
      ) : (
        <main className="flex-grow animate-fade-in">
          <div className="pt-6">
            <h1 className="px-4 pb-3 text-left text-[32px] font-bold leading-tight tracking-tight text-foreground">
              {t('finalReport.reportSummary')}
            </h1>

            {/* Display formatted report summary */}
            {reportData?.job_description && (
              <div className="px-4 pb-6">
                {(() => {
                  const text = reportData.job_description;
                  
                  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
                  const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
                  const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
                  
                  return (
                    <div className="space-y-4">
                      {summaryMatch && (
                        <div className="rounded-lg bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-foreground">{t('finalReport.summary')}</h2>
                            {editingSection !== 'summary' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSection('summary', summaryMatch[1].trim())}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {editingSection === 'summary' ? (
                            <div className="space-y-2">
                              <RichTextEditor
                                content={editedContent['summary'] || ''}
                                onChange={(content) => setEditedContent({ ...editedContent, summary: content })}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveSection('summary')}
                                  disabled={isSaving}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {isSaving ? t('finalReport.saving') : t('finalReport.save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={isSaving}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('finalReport.cancel')}
                                </Button>
                                <div className="ml-auto flex items-center gap-2">
                                  {voiceTranscription.isRecording && (
                                    <span className="text-xs text-red-400 animate-pulse">
                                      ● {voiceTranscription.formatTime(voiceTranscription.recordingTime)}
                                    </span>
                                  )}
                                  {voiceTranscription.isTranscribing && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Transcribing...
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={voiceTranscription.isRecording ? "destructive" : "outline"}
                                    onClick={voiceTranscription.isRecording ? voiceTranscription.stopRecording : voiceTranscription.startRecording}
                                    disabled={voiceTranscription.isTranscribing}
                                    className={voiceTranscription.isRecording ? "animate-pulse" : ""}
                                  >
                                    {voiceTranscription.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(summaryMatch[1].trim()) }}
                            />
                          )}
                        </div>
                      )}
                      
                      {keyPointsMatch && (
                        <div className="rounded-lg bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-foreground">{t('finalReport.keyPoints')}</h2>
                            {editingSection !== 'keypoints' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSection('keypoints', keyPointsMatch[1].trim())}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {editingSection === 'keypoints' ? (
                            <div className="space-y-2">
                              <RichTextEditor
                                content={editedContent['keypoints'] || ''}
                                onChange={(content) => setEditedContent({ ...editedContent, keypoints: content })}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveSection('keypoints')}
                                  disabled={isSaving}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {isSaving ? t('finalReport.saving') : t('finalReport.save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={isSaving}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('finalReport.cancel')}
                                </Button>
                                <div className="ml-auto flex items-center gap-2">
                                  {voiceTranscription.isRecording && (
                                    <span className="text-xs text-red-400 animate-pulse">
                                      ● {voiceTranscription.formatTime(voiceTranscription.recordingTime)}
                                    </span>
                                  )}
                                  {voiceTranscription.isTranscribing && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Transcribing...
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={voiceTranscription.isRecording ? "destructive" : "outline"}
                                    onClick={voiceTranscription.isRecording ? voiceTranscription.stopRecording : voiceTranscription.startRecording}
                                    disabled={voiceTranscription.isTranscribing}
                                    className={voiceTranscription.isRecording ? "animate-pulse" : ""}
                                  >
                                    {voiceTranscription.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(keyPointsMatch[1].trim()) }}
                            />
                          )}
                        </div>
                      )}
                      
                      {actionItemsMatch && (
                        <div className="rounded-lg bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-foreground">{t('finalReport.actionItems')}</h2>
                            {editingSection !== 'actions' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSection('actions', actionItemsMatch[1].trim())}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {editingSection === 'actions' ? (
                            <div className="space-y-2">
                              <RichTextEditor
                                content={editedContent['actions'] || ''}
                                onChange={(content) => setEditedContent({ ...editedContent, actions: content })}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveSection('actions')}
                                  disabled={isSaving}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {isSaving ? t('finalReport.saving') : t('finalReport.save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={isSaving}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('finalReport.cancel')}
                                </Button>
                                <div className="ml-auto flex items-center gap-2">
                                  {voiceTranscription.isRecording && (
                                    <span className="text-xs text-red-400 animate-pulse">
                                      ● {voiceTranscription.formatTime(voiceTranscription.recordingTime)}
                                    </span>
                                  )}
                                  {voiceTranscription.isTranscribing && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Transcribing...
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={voiceTranscription.isRecording ? "destructive" : "outline"}
                                    onClick={voiceTranscription.isRecording ? voiceTranscription.stopRecording : voiceTranscription.startRecording}
                                    disabled={voiceTranscription.isTranscribing}
                                    className={voiceTranscription.isRecording ? "animate-pulse" : ""}
                                  >
                                    {voiceTranscription.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(actionItemsMatch[1].trim()) }}
                            />
                          )}
                        </div>
                      )}
                      
                      {!summaryMatch && !keyPointsMatch && !actionItemsMatch && (
                        <div className="rounded-lg bg-card p-4">
                          <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                            {text}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Photos Section */}
            {media.length > 0 && (
              <div className="px-4 pb-8">
                <h2 className="pb-4 text-2xl font-bold text-foreground">
                  {t('finalReport.photosMedia')} ({media.length})
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {media.slice(0, 6).map((item) => (
                    <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      {item.file_type === 'image' ? (
                        <>
                          <img
                            src={getMediaUrl(item.id)}
                            alt="Project media"
                            className="h-full w-full object-cover"
                          />
                          {/* GPS & Timestamp overlay */}
                          <PhotoTimestamp
                            latitude={item.latitude}
                            longitude={item.longitude}
                            capturedAt={item.captured_at}
                            locationName={item.location_name}
                            variant="overlay"
                          />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <p className="text-sm text-muted-foreground">{t('finalReport.video')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {media.length > 6 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    + {media.length - 6} {t('finalReport.morePhotos')}
                  </p>
                )}
              </div>
            )}

            {/* Checklists Section */}
            {checklists.map((checklist) => (
              <div key={checklist.id} className="px-4 pb-8">
                <h2 className="pb-2 text-2xl font-bold text-foreground">
                  {checklist.title}
                </h2>
                <div className="space-y-3">
                  {checklist.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg bg-card p-3">
                      <div className={`mt-0.5 h-5 w-5 rounded border-2 flex-shrink-0 ${
                        item.completed ? 'bg-primary border-primary' : 'border-muted-foreground'
                      }`}>
                        {item.completed && (
                          <svg className="h-full w-full text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-base leading-relaxed ${
                          item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}>
                          {item.text}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                            item.priority === 'medium' ? 'bg-primary/20 text-primary' :
                            'bg-secondary text-muted-foreground'
                          }`}>
                            {item.priority}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Project Details Section */}
            <div className="px-4 pb-8">
              <h2 className="pb-2 text-2xl font-bold text-foreground">
                {t('finalReport.projectInfo')}
              </h2>
              <div className="space-y-2 rounded-lg bg-card p-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finalReport.customer')}:</span>
                  <span className="font-medium text-foreground">{reportData?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finalReport.jobNumber')}:</span>
                  <span className="font-medium text-foreground">{reportData?.job_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finalReport.created')}:</span>
                  <span className="font-medium text-foreground">
                    {reportData?.created_at ? formatDate(new Date(reportData.created_at)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {media.length === 0 && checklists.length === 0 && (
              <div className="px-4 pb-8">
                <div className="rounded-lg bg-card p-8 text-center">
                  <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t('finalReport.noPhotosChecklists')}
                  </p>
                </div>
              </div>
            )}

            {/* Cloud Storage Options */}
            <div className="px-4 pb-8">
              <h3 className="mb-4 text-base font-medium text-muted-foreground">
                {t('finalReport.alsoSendTo')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => toast({ title: t('finalReport.sendingToGoogleDrive') })}
                  className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                    📄
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Google Drive
                  </span>
                </button>
                <button
                  onClick={() => toast({ title: t('finalReport.sendingToOneDrive') })}
                  className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                    📁
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    OneDrive
                  </span>
                </button>
                <button
                  onClick={() => toast({ title: t('finalReport.sendingToDropbox') })}
                  className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                    📦
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Dropbox
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

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
            disabled={!reportData || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : showSuccess ? (
              <Check className="h-5 w-5 animate-in zoom-in-50 duration-300" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            {isSaving ? t('finalReport.saving') : showSuccess ? t('finalReport.quickSave') : t('finalReport.quickSave')}
          </Button>
        </div>

        {/* Secondary Actions Bar */}
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Print Button */}
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="gap-2 text-zinc-200 hover:text-white border-zinc-600 flex-shrink-0"
              disabled={!reportData}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{t('finalReport.print')}</span>
            </Button>

            {/* Copy Link Button */}
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              size="sm"
              className="gap-2 text-zinc-200 hover:text-white flex-shrink-0"
            >
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">{t('finalReport.copyLink')}</span>
            </Button>

            {/* Export PDF — prominent labeled button */}
            <Button
              id="export-pdf-btn"
              onClick={handleDownloadPDF}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 flex-1 font-semibold"
              disabled={!reportData}
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>

            {/* More options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-zinc-200 hover:text-white border-zinc-600 flex-shrink-0"
                  disabled={!reportData}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={handleDownloadPDF} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  {t('finalReport.saveAsPDF')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadWord} className="gap-2 cursor-pointer">
                  <Download className="h-4 w-4" />
                  {t('finalReport.saveAsWord')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalReport;
