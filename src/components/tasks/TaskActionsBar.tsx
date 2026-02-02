import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Share2, Mail, Loader2, Check, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  created_at: string;
}

interface TaskActionsBarProps {
  tasks: Task[];
  projectName?: string;
  reportId?: string;
  onSaveToProject: () => void;
}

export const TaskActionsBar = ({ tasks, projectName, reportId, onSaveToProject }: TaskActionsBarProps) => {
  const { t } = useTranslation();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMode, setShareMode] = useState<'email' | 'link' | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipientEmail: '',
    recipientName: '',
    message: ''
  });

  const generateTaskListText = () => {
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    let text = `${t('tasks.title')}${projectName ? ` - ${projectName}` : ''}\n`;
    text += `${t('common.generatedOn', { date: new Date().toLocaleDateString() })}\n\n`;

    if (pendingTasks.length > 0) {
      text += `${t('tasks.filterPending')} (${pendingTasks.length})\n`;
      text += '─'.repeat(30) + '\n';
      pendingTasks.forEach(task => {
        text += `○ ${task.title}\n`;
        if (task.description) text += `   ${task.description}\n`;
        text += `   ${t('tasks.priority')}: ${t(`tasks.priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`)}\n\n`;
      });
    }

    if (inProgressTasks.length > 0) {
      text += `\n${t('tasks.filterInprogress')} (${inProgressTasks.length})\n`;
      text += '─'.repeat(30) + '\n';
      inProgressTasks.forEach(task => {
        text += `◐ ${task.title}\n`;
        if (task.description) text += `   ${task.description}\n`;
        text += `   ${t('tasks.priority')}: ${t(`tasks.priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`)}\n\n`;
      });
    }

    if (completedTasks.length > 0) {
      text += `\n${t('tasks.filterCompleted')} (${completedTasks.length})\n`;
      text += '─'.repeat(30) + '\n';
      completedTasks.forEach(task => {
        text += `● ${task.title}\n`;
        if (task.description) text += `   ${task.description}\n\n`;
      });
    }

    return text;
  };

  const generateTaskListHtml = () => {
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'high': return '#ef4444';
        case 'medium': return '#f59e0b';
        case 'low': return '#6b7280';
        default: return '#6b7280';
      }
    };

    let html = `
      <html>
      <head>
        <title>${t('tasks.title')}${projectName ? ` - ${projectName}` : ''}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1a1a1a; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 30px; }
          h2 { color: #333; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; margin-top: 30px; }
          .task { padding: 15px; margin: 10px 0; border-radius: 8px; background: #f9f9f9; }
          .task-title { font-weight: 600; margin-bottom: 5px; }
          .task-description { color: #666; font-size: 14px; margin-bottom: 8px; }
          .task-meta { display: flex; gap: 15px; font-size: 12px; }
          .priority { padding: 2px 8px; border-radius: 4px; color: white; }
          .completed .task-title { text-decoration: line-through; color: #999; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${t('tasks.title')}${projectName ? ` - ${projectName}` : ''}</h1>
        <p class="subtitle">${t('common.generatedOn', { date: new Date().toLocaleDateString() })} • ${tasks.length} ${t('tasks.title').toLowerCase()}</p>
    `;

    if (pendingTasks.length > 0) {
      html += `<h2>○ ${t('tasks.filterPending')} (${pendingTasks.length})</h2>`;
      pendingTasks.forEach(task => {
        html += `
          <div class="task">
            <div class="task-title">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            <div class="task-meta">
              <span class="priority" style="background: ${getPriorityColor(task.priority)}">${t(`tasks.priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`)}</span>
            </div>
          </div>
        `;
      });
    }

    if (inProgressTasks.length > 0) {
      html += `<h2>◐ ${t('tasks.filterInprogress')} (${inProgressTasks.length})</h2>`;
      inProgressTasks.forEach(task => {
        html += `
          <div class="task">
            <div class="task-title">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            <div class="task-meta">
              <span class="priority" style="background: ${getPriorityColor(task.priority)}">${t(`tasks.priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`)}</span>
            </div>
          </div>
        `;
      });
    }

    if (completedTasks.length > 0) {
      html += `<h2>● ${t('tasks.filterCompleted')} (${completedTasks.length})</h2>`;
      completedTasks.forEach(task => {
        html += `
          <div class="task completed">
            <div class="task-title">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
          </div>
        `;
      });
    }

    html += `</body></html>`;
    return html;
  };

  const handlePrint = () => {
    if (tasks.length === 0) {
      toast.error(t('tasks.noTasks'));
      return;
    }

    const html = generateTaskListHtml();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleCopyLink = async () => {
    const taskListText = generateTaskListText();
    
    try {
      await navigator.clipboard.writeText(taskListText);
      setIsCopied(true);
      toast.success(t('tasks.linkCopied'));
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error(t('common.copyFailed'));
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.recipientEmail.trim()) {
      toast.error(t('common.emailRequired'));
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_name')
        .eq('id', user.id)
        .single();

      const senderName = profile?.first_name && profile?.last_name 
        ? `${profile.first_name} ${profile.last_name}`
        : profile?.company_name || 'Field Report AI User';

      const taskListHtml = generateTaskListHtml();
      
      // Create a simple text version for the email body
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${t('tasks.title')}${projectName ? ` - ${projectName}` : ''}</h2>
          <p>${senderName} has shared a task list with you.</p>
          ${emailForm.message ? `<p style="font-style: italic; color: #666;">"${emailForm.message}"</p>` : ''}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e5e5;" />
          ${taskListHtml}
        </div>
      `;

      const { error } = await supabase.functions.invoke('send-export-email', {
        body: {
          recipientEmail: emailForm.recipientEmail,
          recipientName: emailForm.recipientName,
          senderName,
          subject: `${t('tasks.title')}${projectName ? ` - ${projectName}` : ''}`,
          message: emailForm.message,
        }
      });

      if (error) throw error;

      toast.success(t('tasks.emailSent'));
      setShowShareDialog(false);
      setShareMode(null);
      setEmailForm({ recipientEmail: '', recipientName: '', message: '' });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(t('tasks.emailError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveToProject = () => {
    if (reportId) {
      // Already linked to a project
      toast.success(t('tasks.savedToProject', { project: projectName }));
    } else {
      // Open project selector
      onSaveToProject();
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveToProject}
          disabled={tasks.length === 0}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {reportId ? t('tasks.saved') : t('tasks.saveToProject')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          disabled={tasks.length === 0}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          {t('common.print')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowShareDialog(true)}
          disabled={tasks.length === 0}
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          {t('common.share')}
        </Button>
      </div>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tasks.shareTaskList')}</DialogTitle>
            <DialogDescription>{t('tasks.shareDescription')}</DialogDescription>
          </DialogHeader>

          {!shareMode ? (
            <div className="flex flex-col gap-3 pt-4">
              <Button
                variant="outline"
                className="justify-start gap-3 h-14"
                onClick={() => setShareMode('email')}
              >
                <Mail className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{t('tasks.shareViaEmail')}</div>
                  <div className="text-xs text-muted-foreground">{t('tasks.shareViaEmailDesc')}</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3 h-14"
                onClick={handleCopyLink}
              >
                {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                <div className="text-left">
                  <div className="font-medium">{t('tasks.copyAsText')}</div>
                  <div className="text-xs text-muted-foreground">{t('tasks.copyAsTextDesc')}</div>
                </div>
              </Button>
            </div>
          ) : shareMode === 'email' ? (
            <div className="space-y-4 pt-4">
              <div>
                <Input
                  placeholder={t('common.recipientEmail')}
                  type="email"
                  value={emailForm.recipientEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                />
              </div>
              <div>
                <Input
                  placeholder={t('common.recipientName')}
                  value={emailForm.recipientName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, recipientName: e.target.value }))}
                />
              </div>
              <div>
                <Textarea
                  placeholder={t('common.optionalMessage')}
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShareMode(null)}
                  className="flex-1"
                >
                  {t('common.back')}
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="flex-1"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {t('common.send')}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
