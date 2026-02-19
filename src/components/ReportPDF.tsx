import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1f2937',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#374151',
  },
  bulletPoint: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#374151',
    marginLeft: 10,
    marginBottom: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 2,
    marginRight: 8,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checklistText: {
    fontSize: 10,
    flex: 1,
    color: '#374151',
  },
  checklistMeta: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  imageContainer: {
    width: '48%',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 120,
    objectFit: 'cover',
    borderRadius: 4,
  },
  imageMetadata: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  // Photo documentation styles (field report / site survey)
  photoDocEntry: {
    marginBottom: 16,
  },
  photoDocImage: {
    width: '100%',
    height: 200,
    objectFit: 'cover',
    borderRadius: 4,
    marginBottom: 6,
  },
  photoDocLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  photoDocDescription: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#374151',
    marginBottom: 4,
  },
  videoEntry: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  videoLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  videoNote: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  videoLink: {
    fontSize: 10,
    color: '#6366f1',
    textDecoration: 'underline',
  },
  shareBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  shareLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 3,
  },
  shareLink: {
    fontSize: 10,
    color: '#2563eb',
    textDecoration: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  footerLink: {
    fontSize: 8,
    color: '#6366f1',
    textDecoration: 'underline',
  },
});

interface MediaItemForPDF {
  id: string;
  file_path: string;
  file_type: string;
  latitude?: number;
  longitude?: number;
  captured_at?: string;
  location_name?: string;
  caption?: string;
  voice_note?: string;
}

interface ReportPDFProps {
  reportData: {
    project_name: string;
    customer_name: string;
    job_number: string;
    job_description: string;
    created_at: string;
    report_type?: string;
    tags?: string[];
  };
  media?: MediaItemForPDF[];
  checklists?: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      text: string;
      completed: boolean;
      priority: string;
      category: string;
    }>;
  }>;
  mediaUrls?: Map<string, string>;
  /** Signed or public URLs for video items, keyed by media id */
  videoUrls?: Map<string, string>;
  /** Permanent public share URL for the project gallery (photos + videos) */
  shareUrl?: string;
}

const getReportTypeLabel = (reportType?: string) => {
  switch (reportType) {
    case 'field':
      return 'Field Report';
    case 'daily':
      return 'Daily Report';
    case 'weekly':
      return 'Weekly Report';
    case 'monthly':
      return 'Monthly Report';
    case 'site_survey':
      return 'Site Survey';
    default:
      return 'Field Report';
  }
};

export const ReportPDF = ({ reportData, media = [], checklists = [], mediaUrls, videoUrls, shareUrl }: ReportPDFProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatCoordinates = (lat?: number, lon?: number) => {
    if (lat === undefined || lon === undefined) return null;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  };

  const formatCaptureDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Helper to strip HTML tags for PDF
  const stripHtml = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  // Parse report sections
  const text = reportData.job_description || '';
  const isPhotoDocType = reportData.report_type === 'field' || reportData.report_type === 'site_survey';

  // Generic section parser - finds all SECTION_NAME: blocks
  const parseSections = (rawText: string) => {
    const sectionRegex = /^([A-Z][A-Z &/]+(?:\([^)]*\))?):\s*$/gm;
    const sections: { title: string; content: string }[] = [];
    let match;
    const matches: { title: string; index: number }[] = [];
    
    while ((match = sectionRegex.exec(rawText)) !== null) {
      matches.push({ title: match[1].trim(), index: match.index + match[0].length });
    }
    
    for (let i = 0; i < matches.length; i++) {
      const end = i + 1 < matches.length ? rawText.lastIndexOf('\n', matches[i + 1].index - matches[i + 1].title.length - 2) : rawText.length;
      const content = rawText.slice(matches[i].index, end).trim();
      if (content) {
        sections.push({ title: matches[i].title, content });
      }
    }
    return sections;
  };

  // Parse photo documentation entries from PHOTO DOCUMENTATION section
  const parsePhotoEntries = (content: string) => {
    const entries: { label: string; description: string }[] = [];
    const photoRegex = /Photo\s+(\d+):\s*([\s\S]*?)(?=Photo\s+\d+:|$)/gi;
    let match;
    while ((match = photoRegex.exec(content)) !== null) {
      entries.push({
        label: `Photo ${match[1]}`,
        description: match[2].trim(),
      });
    }
    return entries;
  };

  // For field/site_survey: parse all sections generically
  const reportSections = isPhotoDocType ? parseSections(stripHtml(text)) : [];
  const photoDocSection = reportSections.find(s => s.title === 'PHOTO DOCUMENTATION');
  const photoEntries = photoDocSection ? parsePhotoEntries(photoDocSection.content) : [];
  const nonPhotoSections = reportSections.filter(s => s.title !== 'PHOTO DOCUMENTATION');

  // Legacy parsing for non-field/site_survey reports
  const summaryMatch = !isPhotoDocType ? text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i) : null;
  const keyPointsMatch = !isPhotoDocType ? text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i) : null;
  const actionItemsMatch = !isPhotoDocType ? text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i) : null;

  // Render bullet-style content
  const renderBulletContent = (content: string) => {
    return content
      .split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
        return (
          <Text key={index} style={styles.bulletPoint}>
            • {cleaned}
          </Text>
        );
      });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{reportData.project_name || 'Field Report'}</Text>
          <Text style={styles.subtitle}>
            {getReportTypeLabel(reportData.report_type)}
            {reportData.job_number ? ` • Job #${reportData.job_number}` : ''}
          </Text>
          <Text style={styles.date}>
            Generated on {formatDate(reportData.created_at)}
          </Text>
        </View>

        {/* Project Information */}
        {(reportData.customer_name || reportData.job_number) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Information</Text>
            {reportData.customer_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer:</Text>
                <Text style={styles.infoValue}>{reportData.customer_name}</Text>
              </View>
            )}
            {reportData.job_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Job Number:</Text>
                <Text style={styles.infoValue}>{reportData.job_number}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>{formatDate(reportData.created_at)}</Text>
            </View>
            {reportData.tags && reportData.tags.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tags:</Text>
                <Text style={styles.infoValue}>{reportData.tags.join(', ')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Field Report / Site Survey: render all parsed sections */}
        {isPhotoDocType && nonPhotoSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content.includes('•') || section.content.includes('-')
              ? renderBulletContent(section.content)
              : <Text style={styles.text}>{section.content}</Text>
            }
          </View>
        ))}

        {/* Field Report / Site Survey: Photo Documentation with descriptions */}
        {isPhotoDocType && media.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Documentation</Text>
            {media.filter(m => m.file_type === 'image').map((item, idx) => {
              const url = mediaUrls?.get(item.id);
              const photoEntry = photoEntries[idx];
              const coords = formatCoordinates(item.latitude, item.longitude);
              const captureDate = formatCaptureDate(item.captured_at);
              const locationDisplay = item.location_name || coords;
              
              return url ? (
                <View key={item.id} style={styles.photoDocEntry} wrap={false}>
                  <Image src={url} style={styles.photoDocImage} />
                  <Text style={styles.photoDocLabel}>
                    {photoEntry?.label || `Photo ${idx + 1}`}
                  </Text>
                  {photoEntry?.description && (
                    <Text style={styles.photoDocDescription}>
                      {photoEntry.description}
                    </Text>
                  )}
                  {(locationDisplay || captureDate) && (
                    <Text style={styles.imageMetadata}>
                      {captureDate && `${captureDate}`}
                      {locationDisplay && captureDate && ' • '}
                      {locationDisplay && `${locationDisplay}`}
                    </Text>
                  )}
                </View>
              ) : null;
            })}
          </View>
        )}

        {/* Non-field/site_survey: Legacy section rendering */}
        {!isPhotoDocType && summaryMatch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.text}>{stripHtml(summaryMatch[1].trim())}</Text>
          </View>
        )}

        {!isPhotoDocType && keyPointsMatch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Points</Text>
            {stripHtml(keyPointsMatch[1].trim())
              .split('\n')
              .filter(line => line.trim())
              .map((point, index) => (
                <Text key={index} style={styles.bulletPoint}>
                  • {point.replace(/^[•\-*]\s*/, '').trim()}
                </Text>
              ))}
          </View>
        )}

        {!isPhotoDocType && actionItemsMatch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action Items</Text>
            {stripHtml(actionItemsMatch[1].trim())
              .split('\n')
              .filter(line => line.trim())
              .map((action, index) => (
                <Text key={index} style={styles.bulletPoint}>
                  • {action.replace(/^[•\-*]\s*/, '').trim()}
                </Text>
              ))}
          </View>
        )}

        {/* Non-field/site_survey: Photos grid (legacy) - show ALL images */}
        {!isPhotoDocType && media.filter(m => m.file_type === 'image').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos & Media ({media.filter(m => m.file_type === 'image').length})
            </Text>
            <View style={styles.imageGrid}>
              {media.filter(m => m.file_type === 'image').map((item) => {
                const url = mediaUrls?.get(item.id);
                const coords = formatCoordinates(item.latitude, item.longitude);
                const captureDate = formatCaptureDate(item.captured_at);
                const locationDisplay = item.location_name || coords;
                
                return url ? (
                  <View key={item.id} style={styles.imageContainer} wrap={false}>
                    <Image src={url} style={styles.image} />
                    {(locationDisplay || captureDate) && (
                      <Text style={styles.imageMetadata}>
                        {captureDate && `${captureDate}`}
                        {locationDisplay && captureDate && ' • '}
                        {locationDisplay && `${locationDisplay}`}
                      </Text>
                    )}
                  </View>
                ) : null;
              })}
            </View>
          </View>
        )}

        {/* Videos Section */}
        {media.filter(m => m.file_type === 'video').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Videos Recorded ({media.filter(m => m.file_type === 'video').length})
            </Text>
            {media.filter(m => m.file_type === 'video').map((item, idx) => {
              const videoUrl = videoUrls?.get(item.id);
              const note = (item as any).caption || (item as any).voice_note;
              return (
                <View key={item.id} style={styles.videoEntry}>
                  <Text style={styles.videoLabel}>Video {idx + 1}</Text>
                  {note ? (
                    <Text style={styles.videoNote}>Note: {note}</Text>
                  ) : null}
                  {videoUrl ? (
                    <Link src={videoUrl} style={styles.videoLink}>
                      ▶ View / Download Video
                    </Link>
                  ) : null}
                  {shareUrl ? (
                    <View style={styles.shareBox}>
                      <Text style={styles.shareLabel}>📱 View all photos & videos in your browser (permanent link):</Text>
                      <Link src={shareUrl} style={styles.shareLink}>{shareUrl}</Link>
                    </View>
                  ) : (
                    !videoUrl ? <Text style={styles.videoNote}>(Video link available when viewing saved report)</Text> : null
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Checklists */}
        {checklists.map((checklist) => (
          <View key={checklist.id} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{checklist.title}</Text>
            {checklist.items.map((item) => (
              <View key={item.id} style={styles.checklistItem}>
                <View
                  style={[
                    styles.checkbox,
                    item.completed && styles.checkboxChecked,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.checklistText}>{item.text}</Text>
                  <Text style={styles.checklistMeta}>
                    {item.priority} priority • {item.category}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Footer with share link */}
        {shareUrl && (
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Field Report AI</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.footerText}>View online: </Text>
              <Link src={shareUrl} style={styles.footerLink}>{shareUrl}</Link>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};