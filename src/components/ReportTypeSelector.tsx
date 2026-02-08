import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Calendar, CalendarDays, MapPin, ChevronDown, ChevronUp, Check, ClipboardList, CalendarRange } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ReportType = 'field_report' | 'daily' | 'weekly' | 'monthly' | 'site_survey';
export type AggregationSourceMode = 'manual' | 'auto' | 'fresh';

interface SourceReport {
  id: string;
  project_name: string;
  created_at: string;
  job_description: string;
  report_type?: string;
}

interface ReportTypeSelectorProps {
  selectedType: ReportType;
  onTypeChange: (type: ReportType) => void;
  aggregationSourceMode: AggregationSourceMode;
  onAggregationSourceModeChange: (mode: AggregationSourceMode) => void;
  availableSourceReports: SourceReport[];
  selectedSourceReportIds: string[];
  onSourceReportSelectionChange: (ids: string[]) => void;
  isLoadingSourceReports?: boolean;
  isSimpleMode?: boolean;
}

export const ReportTypeSelector = ({
  selectedType,
  onTypeChange,
  aggregationSourceMode,
  onAggregationSourceModeChange,
  availableSourceReports,
  selectedSourceReportIds,
  onSourceReportSelectionChange,
  isLoadingSourceReports = false,
  isSimpleMode = false,
}: ReportTypeSelectorProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  // All report types - Simple Mode only shows Field Report
  const allReportTypes = [
    {
      value: 'field_report' as ReportType,
      icon: ClipboardList,
      label: t('reportType.fieldReport', 'Field Report'),
      description: t('reportType.fieldReportDesc', 'Quick observations, photos, and issues from the field'),
      simpleMode: true,
      projectMode: true,
    },
    {
      value: 'daily' as ReportType,
      icon: FileText,
      label: t('reportType.daily', 'Daily Report'),
      description: t('reportType.dailyDesc', 'Document daily activities and progress'),
      simpleMode: false,
      projectMode: true,
    },
    {
      value: 'weekly' as ReportType,
      icon: CalendarDays,
      label: t('reportType.weekly', 'Weekly Report'),
      description: t('reportType.weeklyDesc', 'Summarize weekly progress and milestones'),
      simpleMode: false,
      projectMode: true,
    },
    {
      value: 'monthly' as ReportType,
      icon: CalendarRange,
      label: t('reportType.monthly', 'Monthly Report'),
      description: t('reportType.monthlyDesc', 'Aggregate weekly reports into monthly overview'),
      simpleMode: false,
      projectMode: true,
    },
    {
      value: 'site_survey' as ReportType,
      icon: MapPin,
      label: t('reportType.siteSurvey', 'Site Survey'),
      description: t('reportType.siteSurveyDesc', 'Document site conditions and assessments'),
      simpleMode: false,
      projectMode: true,
    },
  ];

  // Filter based on mode
  const reportTypes = isSimpleMode 
    ? allReportTypes.filter(r => r.simpleMode)
    : allReportTypes.filter(r => r.projectMode);

  const aggregationSourceOptions = [
    {
      value: 'auto' as AggregationSourceMode,
      label: t('reportType.autoDetect', 'Auto-detect'),
      description: selectedType === 'monthly' 
        ? t('reportType.autoDetectMonthlyDesc', 'Include weekly reports from this month')
        : t('reportType.autoDetectDesc', 'Include daily reports from this week'),
    },
    {
      value: 'manual' as AggregationSourceMode,
      label: t('reportType.manualSelect', 'Manual selection'),
      description: selectedType === 'monthly'
        ? t('reportType.manualSelectMonthlyDesc', 'Choose which weekly reports to include')
        : t('reportType.manualSelectDesc', 'Choose which daily reports to include'),
    },
    {
      value: 'fresh' as AggregationSourceMode,
      label: t('reportType.freshStart', 'Start fresh'),
      description: t('reportType.freshStartDesc', 'Create report from current content only'),
    },
  ];

  const toggleSourceReport = (reportId: string) => {
    const newSelection = selectedSourceReportIds.includes(reportId)
      ? selectedSourceReportIds.filter(id => id !== reportId)
      : [...selectedSourceReportIds, reportId];
    onSourceReportSelectionChange(newSelection);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Show aggregation options for weekly and monthly reports
  const showAggregationOptions = selectedType === 'weekly' || selectedType === 'monthly';
  const aggregationLabel = selectedType === 'monthly' 
    ? t('reportType.monthlySource', 'Include Weekly Reports')
    : t('reportType.weeklySource', 'Include Daily Reports');

  const sourceReportTypeLabel = selectedType === 'monthly'
    ? t('reportType.selectWeeklyReports', 'Select Weekly Reports')
    : t('reportType.selectDailyReports', 'Select Daily Reports');

  const noReportsMessage = selectedType === 'monthly'
    ? t('reportType.noWeeklyReports', 'No weekly reports available')
    : t('reportType.noDailyReports', 'No daily reports available');

  const autoDetectInfo = selectedType === 'monthly'
    ? t('reportType.autoDetectMonthlyInfo', '{{count}} weekly report(s) from this month will be included', { count: availableSourceReports.length })
    : t('reportType.autoDetectInfo', '{{count}} daily report(s) from this week will be included', { count: availableSourceReports.length });

  // In Simple Mode, show a simpler collapsed view
  if (isSimpleMode && reportTypes.length === 1) {
    return (
      <div className="rounded-xl bg-card border border-border/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('reportType.fieldReport', 'Field Report')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('reportType.fieldReportDesc', 'Quick observations, photos, and issues from the field')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="rounded-xl bg-card border border-border/50"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {selectedType === 'field_report' && <ClipboardList className="h-5 w-5 text-primary" />}
            {selectedType === 'daily' && <FileText className="h-5 w-5 text-primary" />}
            {selectedType === 'weekly' && <CalendarDays className="h-5 w-5 text-primary" />}
            {selectedType === 'monthly' && <CalendarRange className="h-5 w-5 text-primary" />}
            {selectedType === 'site_survey' && <MapPin className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('reportType.selectType', 'Report Type')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {reportTypes.find(r => r.value === selectedType)?.label}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Report Type Selection */}
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => onTypeChange(value as ReportType)}
            className="grid gap-3"
          >
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              
              return (
                <Label
                  key={type.value}
                  htmlFor={type.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  )}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{type.label}</div>
                    <div className="text-sm text-muted-foreground">{type.description}</div>
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </Label>
              );
            })}
          </RadioGroup>

          {/* Aggregation Options for Weekly and Monthly Reports */}
          {showAggregationOptions && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground">
                {aggregationLabel}
              </h4>
              
              <RadioGroup
                value={aggregationSourceMode}
                onValueChange={(value) => onAggregationSourceModeChange(value as AggregationSourceMode)}
                className="grid gap-2"
              >
                {aggregationSourceOptions.map((option) => {
                  const isSelected = aggregationSourceMode === option.value;
                  
                  return (
                    <Label
                      key={option.value}
                      htmlFor={`agg-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                      )}
                    >
                      <RadioGroupItem 
                        value={option.value} 
                        id={`agg-${option.value}`} 
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </Label>
                  );
                })}
              </RadioGroup>

              {/* Manual Selection of Source Reports */}
              {aggregationSourceMode === 'manual' && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {sourceReportTypeLabel}
                  </h5>
                  
                  {isLoadingSourceReports ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : availableSourceReports.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center bg-secondary/20 rounded-lg">
                      {noReportsMessage}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableSourceReports.map((report) => {
                        const isChecked = selectedSourceReportIds.includes(report.id);
                        
                        return (
                          <Label
                            key={report.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                              isChecked
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/30 bg-secondary/10 hover:bg-secondary/20"
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSourceReport(report.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-foreground truncate">
                                {report.project_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(report.created_at)}
                              </div>
                            </div>
                          </Label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Auto-detect info */}
              {aggregationSourceMode === 'auto' && availableSourceReports.length > 0 && (
                <div className="text-xs text-muted-foreground bg-secondary/20 rounded-lg p-3">
                  {autoDetectInfo}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Legacy exports for backward compatibility
export type WeeklySourceMode = AggregationSourceMode;
