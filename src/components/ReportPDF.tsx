import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
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
    border: 1,
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
  image: {
    width: '48%',
    height: 120,
    objectFit: 'cover',
    borderRadius: 4,
  },
});

interface ReportPDFProps {
  reportData: {
    project_name: string;
    customer_name: string;
    job_number: string;
    job_description: string;
    created_at: string;
  };
  media?: Array<{ id: string; file_path: string; file_type: string }>;
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
}

export const ReportPDF = ({ reportData, media = [], checklists = [], mediaUrls }: ReportPDFProps) => {
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

  // Parse report sections
  const text = reportData.job_description || '';
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
  const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
  const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);

  // Helper to strip HTML tags for PDF
  const stripHtml = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{reportData.project_name}</Text>
          <Text style={styles.subtitle}>
            {reportData.customer_name} • Job #{reportData.job_number}
          </Text>
          <Text style={styles.date}>
            Generated on {formatDate(reportData.created_at)}
          </Text>
        </View>

        {/* Report Summary Sections */}
        {summaryMatch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.text}>{stripHtml(summaryMatch[1].trim())}</Text>
          </View>
        )}

        {keyPointsMatch && (
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

        {actionItemsMatch && (
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

        {/* Project Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue}>{reportData.customer_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Job Number:</Text>
            <Text style={styles.infoValue}>{reportData.job_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>{formatDate(reportData.created_at)}</Text>
          </View>
        </View>

        {/* Photos & Media */}
        {media.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              Photos & Media ({media.length})
            </Text>
            <View style={styles.imageGrid}>
              {media.slice(0, 4).map((item) => {
                const url = mediaUrls?.get(item.id);
                return item.file_type === 'image' && url ? (
                  <Image
                    key={item.id}
                    src={url}
                    style={styles.image}
                  />
                ) : null;
              })}
            </View>
            {media.length > 4 && (
              <Text style={styles.text}>
                + {media.length - 4} more photo{media.length - 4 !== 1 ? 's' : ''}
              </Text>
            )}
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
      </Page>
    </Document>
  );
};
