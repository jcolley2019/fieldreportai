import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Camera, Mic, Video, FileText, Zap, CheckSquare, Mail, Link2, Download, Share2, MessageSquare, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StepPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 'capture' | 'generate' | 'share' | null;
}

const StepPreviewDialog: React.FC<StepPreviewDialogProps> = ({
  open,
  onOpenChange,
  step,
}) => {
  if (!step) return null;

  const content = {
    capture: {
      title: 'Capture Screen',
      description: 'Easily capture all your on-site documentation in seconds',
      features: [
        {
          icon: <Camera className="h-8 w-8" />,
          title: 'Photo Capture',
          description: 'Take high-quality photos with automatic labeling and organization',
          color: 'bg-blue-500/10 text-blue-500',
        },
        {
          icon: <Video className="h-8 w-8" />,
          title: 'Video Recording',
          description: 'Record walkthrough videos with voice narration for detailed documentation',
          color: 'bg-purple-500/10 text-purple-500',
        },
        {
          icon: <Mic className="h-8 w-8" />,
          title: 'Voice Notes',
          description: 'Speak your notes and let AI transcribe them into organized text',
          color: 'bg-green-500/10 text-green-500',
        },
      ],
      mockup: (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Live Camera</Badge>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Recording</span>
            </div>
          </div>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/20"></div>
            <Camera className="h-16 w-16 text-muted-foreground/50" />
            <div className="absolute bottom-2 left-2 right-2 flex justify-between">
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Video className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <Camera className="h-4 w-4 text-muted-foreground/30" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    generate: {
      title: 'Generate Reports',
      description: 'AI transforms your captures into professional documentation',
      features: [
        {
          icon: <FileText className="h-8 w-8" />,
          title: 'Field Reports',
          description: 'Daily reports, progress updates, and safety documentation',
          color: 'bg-blue-500/10 text-blue-500',
        },
        {
          icon: <CheckSquare className="h-8 w-8" />,
          title: 'Smart Checklists',
          description: 'AI-generated checklists from your voice notes and observations',
          color: 'bg-amber-500/10 text-amber-500',
        },
        {
          icon: <Zap className="h-8 w-8" />,
          title: 'Instant Processing',
          description: 'Reports generated in seconds, not hours',
          color: 'bg-green-500/10 text-green-500',
        },
      ],
      mockup: (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">AI Report Generator</Badge>
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ready</Badge>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Daily Progress Report</span>
              </div>
              <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full animate-pulse"></div>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Safety Inspection Checklist</span>
              </div>
              <div className="space-y-1">
                {['Foundation inspection', 'Electrical systems', 'Safety equipment'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded border border-primary bg-primary/20 flex items-center justify-center">
                      <span className="text-[8px] text-primary">✓</span>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    share: {
      title: 'Share & Distribute',
      description: 'Multiple ways to share your reports with your team and clients',
      features: [
        {
          icon: <Mail className="h-8 w-8" />,
          title: 'Email Reports',
          description: 'Send professional PDF reports directly to clients and stakeholders',
          color: 'bg-blue-500/10 text-blue-500',
        },
        {
          icon: <Link2 className="h-8 w-8" />,
          title: 'Shareable Links',
          description: 'Generate secure links for easy access without login required',
          color: 'bg-purple-500/10 text-purple-500',
        },
        {
          icon: <Download className="h-8 w-8" />,
          title: 'Export Options',
          description: 'Download as PDF, Word Doc, or integrate with your existing tools',
          color: 'bg-green-500/10 text-green-500',
        },
      ],
      mockup: (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Share Report</Badge>
          </div>
          <div className="space-y-3">
            {[
              { icon: <Mail className="h-5 w-5" />, label: 'Send via Email', desc: 'PDF attachment', color: 'text-blue-500' },
              { icon: <Link2 className="h-5 w-5" />, label: 'Copy Share Link', desc: 'Expires in 7 days', color: 'text-purple-500' },
              { icon: <Download className="h-5 w-5" />, label: 'Download PDF', desc: '2.4 MB', color: 'text-green-500' },
              { icon: <FileText className="h-5 w-5" />, label: 'Export to Word', desc: '.docx format', color: 'text-amber-500' },
              { icon: <MessageSquare className="h-5 w-5" />, label: 'Send to Slack', desc: '#project-updates', color: 'text-pink-500' },
              { icon: <Users className="h-5 w-5" />, label: 'Team Access', desc: '5 team members', color: 'text-cyan-500' },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer group"
              >
                <div className={`${item.color}`}>{item.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <Share2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
  };

  const currentContent = content[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{currentContent.title}</DialogTitle>
          <DialogDescription className="text-base">
            {currentContent.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Features List */}
          <div className="space-y-4">
            {currentContent.features.map((feature, index) => (
              <div 
                key={index}
                className="flex gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
              >
                <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center flex-shrink-0`}>
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mockup Preview */}
          <div>
            {currentContent.mockup}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StepPreviewDialog;
