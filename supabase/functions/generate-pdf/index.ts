import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "https://cdn.skypack.dev/pdf-lib@1.17.1?dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  reportId: z.string().uuid(),
  userId: z.string().uuid(),
});

// Helper: wrap text at a given max width (in pts)
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// Strip basic HTML tags
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reportId, userId } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch media
    const { data: mediaItems } = await supabase
      .from('media')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    // 3. Fetch checklists with items
    const { data: checklists } = await supabase
      .from('checklists')
      .select('*, checklist_items(*)')
      .eq('report_id', reportId);

    // ----------------------------------------------------------------
    // Build PDF with pdf-lib
    // ----------------------------------------------------------------
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = PageSizes.A4[0];  // 595
    const pageHeight = PageSizes.A4[1]; // 842
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Track current Y position across pages
    let page = pdfDoc.addPage(PageSizes.A4);
    let y = pageHeight - margin;

    const FONT_TITLE = 20;
    const FONT_SUBTITLE = 12;
    const FONT_SECTION = 14;
    const FONT_BODY = 10;
    const LINE_HEIGHT_BODY = 14;
    const LINE_HEIGHT_SECTION = 20;
    const CHARS_PER_LINE = 85;

    // Ensure we have space; add new page if needed
    function ensureSpace(needed: number) {
      if (y - needed < margin + 30) {
        page = pdfDoc.addPage(PageSizes.A4);
        y = pageHeight - margin;
      }
    }

    function drawText(
      text: string,
      opts: { size: number; font: typeof fontBold; color?: [number, number, number]; indent?: number }
    ) {
      const { size, font, color = [0.1, 0.1, 0.1], indent = 0 } = opts;
      const [r, g, b] = color;
      ensureSpace(size + 4);
      page.drawText(text, {
        x: margin + indent,
        y,
        size,
        font,
        color: rgb(r, g, b),
        maxWidth: contentWidth - indent,
      });
      y -= size + 4;
    }

    function drawWrappedText(
      text: string,
      opts: { size: number; font: typeof fontRegular; color?: [number, number, number]; indent?: number; lineHeight?: number }
    ) {
      const { size, font, color = [0.2, 0.2, 0.2], indent = 0, lineHeight = LINE_HEIGHT_BODY } = opts;
      const [r, g, b] = color;
      const lines = wrapText(text, CHARS_PER_LINE - Math.floor(indent / 5));
      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font,
          color: rgb(r, g, b),
        });
        y -= lineHeight;
      }
    }

    function drawSeparator() {
      ensureSpace(12);
      page.drawLine({
        start: { x: margin, y: y + 4 },
        end: { x: pageWidth - margin, y: y + 4 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= 8;
    }

    // ---- HEADER ----
    drawText(report.project_name || 'Field Report', {
      size: FONT_TITLE,
      font: fontBold,
      color: [0.08, 0.08, 0.08],
    });

    const reportTypeLabel = {
      field: 'Field Report',
      daily: 'Daily Report',
      weekly: 'Weekly Report',
      monthly: 'Monthly Report',
      site_survey: 'Site Survey',
    }[report.report_type as string] ?? 'Field Report';

    const subtitleParts = [reportTypeLabel];
    if (report.job_number) subtitleParts.push(`Job #${report.job_number}`);
    drawText(subtitleParts.join(' • '), {
      size: FONT_SUBTITLE,
      font: fontRegular,
      color: [0.4, 0.4, 0.4],
    });

    const createdDate = new Date(report.created_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    drawText(`Generated on ${createdDate}`, {
      size: 9,
      font: fontRegular,
      color: [0.6, 0.6, 0.6],
    });

    y -= 6;
    drawSeparator();
    y -= 4;

    // ---- PROJECT INFORMATION ----
    if (report.customer_name || report.job_number) {
      drawText('Project Information', { size: FONT_SECTION, font: fontBold, color: [0.1, 0.1, 0.1] });
      y -= 2;
      if (report.customer_name) {
        drawText(`Customer: ${report.customer_name}`, { size: FONT_BODY, font: fontRegular });
      }
      if (report.job_number) {
        drawText(`Job Number: ${report.job_number}`, { size: FONT_BODY, font: fontRegular });
      }
      drawText(`Date: ${createdDate}`, { size: FONT_BODY, font: fontRegular });
      if (report.tags && report.tags.length > 0) {
        drawText(`Tags: ${report.tags.join(', ')}`, { size: FONT_BODY, font: fontRegular });
      }
      y -= 8;
    }

    // ---- REPORT BODY ----
    const bodyText = stripHtml(report.job_description || '');
    if (bodyText) {
      // Parse sections (ALL_CAPS heading followed by colon)
      const sectionRegex = /^([A-Z][A-Z &/]+(?:\([^)]*\))?):\s*$/gm;
      const matches: { title: string; index: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = sectionRegex.exec(bodyText)) !== null) {
        matches.push({ title: m[1].trim(), index: m.index + m[0].length });
      }

      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const end = i + 1 < matches.length
            ? bodyText.lastIndexOf('\n', matches[i + 1].index - 2)
            : bodyText.length;
          const content = bodyText.slice(matches[i].index, end).trim();
          if (!content) continue;

          drawSeparator();
          drawText(matches[i].title, { size: FONT_SECTION, font: fontBold, color: [0.1, 0.1, 0.1] });
          y -= 2;
          const bodyLines = content.split('\n').filter(l => l.trim());
          for (const line of bodyLines) {
            const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
            if (!cleaned) continue;
            drawWrappedText(`• ${cleaned}`, { size: FONT_BODY, font: fontRegular, indent: 4 });
          }
          y -= 6;
        }
      } else {
        // No sections — just dump the text
        drawSeparator();
        drawText('Report Details', { size: FONT_SECTION, font: fontBold });
        y -= 2;
        drawWrappedText(bodyText, { size: FONT_BODY, font: fontRegular });
        y -= 6;
      }
    }

    // ---- MEDIA SUMMARY ----
    const images = (mediaItems ?? []).filter(m => m.file_type === 'image');
    const videos = (mediaItems ?? []).filter(m => m.file_type === 'video');

    if (images.length > 0 || videos.length > 0) {
      drawSeparator();
      drawText('Media Attached', { size: FONT_SECTION, font: fontBold, color: [0.1, 0.1, 0.1] });
      y -= 2;
      if (images.length > 0) {
        drawText(`• ${images.length} photo${images.length !== 1 ? 's' : ''} captured`, {
          size: FONT_BODY, font: fontRegular,
        });
      }
      if (videos.length > 0) {
        drawText(`• ${videos.length} video${videos.length !== 1 ? 's' : ''} recorded`, {
          size: FONT_BODY, font: fontRegular,
        });
      }
      y -= 6;
    }

    // ---- CHECKLISTS ----
    if (checklists && checklists.length > 0) {
      for (const checklist of checklists) {
        drawSeparator();
        drawText(checklist.title, { size: FONT_SECTION, font: fontBold, color: [0.1, 0.1, 0.1] });
        y -= 2;

        const items = (checklist as any).checklist_items ?? [];
        for (const item of items) {
          const checkMark = item.completed ? '[✓]' : '[ ]';
          ensureSpace(LINE_HEIGHT_BODY + 4);

          // Draw checkbox indicator
          page.drawText(checkMark, {
            x: margin,
            y,
            size: FONT_BODY,
            font: item.completed ? fontBold : fontRegular,
            color: item.completed ? rgb(0.23, 0.51, 0.97) : rgb(0.4, 0.4, 0.4),
          });

          // Draw item text
          const itemLines = wrapText(item.text, CHARS_PER_LINE - 5);
          for (let li = 0; li < itemLines.length; li++) {
            if (li > 0) ensureSpace(LINE_HEIGHT_BODY);
            page.drawText(itemLines[li], {
              x: margin + 30,
              y,
              size: FONT_BODY,
              font: fontRegular,
              color: rgb(0.2, 0.2, 0.2),
            });
            y -= LINE_HEIGHT_BODY;
          }

          // Meta row
          const meta = `${item.priority} priority · ${item.category}`;
          ensureSpace(12);
          page.drawText(meta, {
            x: margin + 30,
            y,
            size: 8,
            font: fontRegular,
            color: rgb(0.55, 0.55, 0.55),
          });
          y -= 14;
        }
        y -= 6;
      }
    }

    // ---- FOOTER on every page ----
    const pageCount = pdfDoc.getPageCount();
    for (let pi = 0; pi < pageCount; pi++) {
      const p = pdfDoc.getPage(pi);
      p.drawLine({
        start: { x: margin, y: margin - 2 },
        end: { x: pageWidth - margin, y: margin - 2 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
      p.drawText('Field Report AI', {
        x: margin,
        y: margin - 14,
        size: 8,
        font: fontRegular,
        color: rgb(0.6, 0.6, 0.6),
      });
      p.drawText(`Page ${pi + 1} of ${pageCount}`, {
        x: pageWidth - margin - 50,
        y: margin - 14,
        size: 8,
        font: fontRegular,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    // ---- Serialize PDF ----
    const pdfBytes = await pdfDoc.save();

    // ---- Upload to Storage ----
    const timestamp = Date.now();
    const filePath = `${userId}/${reportId}/report_${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Record metadata in documents table ----
    const fileName = `${report.project_name || 'report'}_${new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.pdf`;

    await supabase.from('documents').insert({
      user_id: userId,
      report_id: reportId,
      file_path: filePath,
      file_name: fileName,
      mime_type: 'application/pdf',
      file_size: pdfBytes.byteLength,
    });

    // ---- Generate signed URL (1-hour TTL) ----
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ pdfUrl: signedData.signedUrl, filePath }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('generate-pdf error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
