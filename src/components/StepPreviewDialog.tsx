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
import previewCapture from '@/assets/preview-capture.png';
import previewGenerate from '@/assets/preview-generate.png';
import previewShare from '@/assets/preview-share.png';

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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <img 
            src={previewCapture} 
            alt="Capture screen preview" 
            className="w-full h-auto rounded-lg shadow-lg"
          />
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <img 
            src={previewGenerate} 
            alt="Generate report preview" 
            className="w-full h-auto rounded-lg shadow-lg"
          />
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <img 
            src={previewShare} 
            alt="Share options preview" 
            className="w-full h-auto rounded-lg shadow-lg"
          />
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
