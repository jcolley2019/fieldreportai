import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Camera, FileText, Share2, ChevronRight, X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    icon: FolderOpen,
    titleKey: 'gettingStarted.step1Title',
    titleFallback: 'Create a Project',
    descKey: 'gettingStarted.step1Desc',
    descFallback: 'Start by creating a new project with your job details, customer info, and job number.',
    link: '/new-project',
  },
  {
    icon: Camera,
    titleKey: 'gettingStarted.step2Title',
    titleFallback: 'Take a Photo, Video, or Note',
    descKey: 'gettingStarted.step2Desc',
    descFallback: 'Capture on-site photos, record videos, or dictate voice notes — all organized automatically.',
    link: '/capture-screen',
  },
  {
    icon: FileText,
    titleKey: 'gettingStarted.step3Title',
    titleFallback: 'Choose a Report Template & Create a Report',
    descKey: 'gettingStarted.step3Desc',
    descFallback: 'Pick from Field, Daily, Weekly, Monthly, or Site Survey templates — AI generates your report instantly.',
    link: null,
  },
  {
    icon: Share2,
    titleKey: 'gettingStarted.step4Title',
    titleFallback: 'Share with Your Team',
    descKey: 'gettingStarted.step4Desc',
    descFallback: 'Email PDF reports, generate shareable links, export to Word, or invite team members to collaborate.',
    link: null,
  },
];

const GettingStartedGuide: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('gettingStartedDismissed') === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('gettingStartedDismissed', 'true');
    setDismissed(true);
  };

  return (
    <section className="mb-8">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t('gettingStarted.title', 'Getting Started')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('gettingStarted.subtitle', 'Follow these steps to make the most of your app')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className={`flex items-start gap-4 rounded-xl border border-border/40 bg-card/50 p-4 transition-all duration-200 ${step.link ? 'cursor-pointer hover:bg-card hover:border-border' : ''}`}
                onClick={() => step.link && navigate(step.link)}
              >
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm mb-0.5">
                    {t(step.titleKey, step.titleFallback)}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(step.descKey, step.descFallback)}
                  </p>
                </div>
                {step.link && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GettingStartedGuide;
