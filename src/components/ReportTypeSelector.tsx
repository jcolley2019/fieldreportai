import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Calendar, CalendarDays, MapPin, ChevronDown, ChevronUp, Check, ClipboardList, CalendarRange, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ReportType = 'field' | 'daily' | 'weekly' | 'monthly' | 'site_survey' | 'timeline';
export type WeeklySourceMode = 'manual' | 'auto' | 'fresh';

interface DailyReport {
  id: string;
  project_name: string;
  created_at: string;
  job_description: string;
  report_type?: string;
}

interface ReportTypeSelectorProps {
  selectedType: ReportType;
  onTypeChange: (type: ReportType) => void;
  weeklySourceMode: WeeklySourceMode;
  onWeeklySourceModeChange: (mode: WeeklySourceMode) => void;
  availableDailyReports: DailyReport[];
  selectedDailyReportIds: string[];
  onDailyReportSelectionChange: (ids: string[]) => void;
  isLoadingDailyReports?: boolean;
  // For monthly reports - weekly reports to aggregate
  availableWeeklyReports?: DailyReport[];
  selectedWeeklyReportIds?: string[];
  onWeeklyReportSelectionChange?: (ids: string[]) => void;
  isLoadingWeeklyReports?: boolean;
}

export const ReportTypeSelector = ({
  selectedType,
  onTypeChange,
  weeklySourceMode,
  onWeeklySourceModeChange,
  availableDailyReports,
  selectedDailyReportIds,
  onDailyReportSelectionChange,
  isLoadingDailyReports = false,
  availableWeeklyReports = [],
  selectedWeeklyReportIds = [],
  onWeeklyReportSelectionChange,
  isLoadingWeeklyReports = false,
}: ReportTypeSelectorProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const reportTypes = [
    {
      value: 'field' as ReportType,
      icon: ClipboardList,
      label: t('reportType.field', 'Field Report'),
      description: t('reportType.fieldDesc', 'Site conditions, work observed, issues found'),
    },
    {
      value: 'daily' as ReportType,
      icon: FileText,
      label: t('reportType.daily', 'Daily Report'),
      description: t('reportType.dailyDesc', 'Document daily activities and progress'),
    },
    {
      value: 'weekly' as ReportType,
      icon: CalendarDays,
      label: t('reportType.weekly', 'Weekly Report'),
      description: t('reportType.weeklyDesc', 'Aggregates daily reports into weekly summary'),
    },
    {
      value: 'monthly' as ReportType,
      icon: CalendarRange,
      label: t('reportType.monthly', 'Monthly Report'),
      description: t('reportType.monthlyDesc', 'Aggregates weekly reports into monthly summary'),
    },
    {
      value: 'site_survey' as ReportType,
      icon: MapPin,
      label: t('reportType.siteSurvey', 'Site Survey'),
      description: t('reportType.siteSurveyDesc', 'Document site conditions and assessments'),
    },
    {
      value: 'timeline' as ReportType,
      icon: Clock,
      label: t('reportType.timeline', 'Timeline'),
      description: t('reportType.timelineDesc', 'Visual timeline of project progress with AI narrative'),
    },
  ];

  const sourceOptions = [
    {
      value: 'auto' as WeeklySourceMode,
      label: t('reportType.autoDetect', 'Auto-detect'),
      description: selectedType === 'monthly' 
        ? t('reportType.autoDetectMonthlyDesc', 'Include weekly reports from this month')
        : t('reportType.autoDetectDesc', 'Include daily reports from this week'),
    },
    {
      value: 'manual' as WeeklySourceMode,
      label: t('reportType.manualSelect', 'Manual selection'),
      description: selectedType === 'monthly'
        ? t('reportType.manualSelectMonthlyDesc', 'Choose which weekly reports to include')
        : t('reportType.manualSelectDesc', 'Choose which daily reports to include'),
    },
    {
      value: 'fresh' as WeeklySourceMode,
      label: t('reportType.freshStart', 'Start fresh'),
      description: t('reportType.freshStartDesc', 'Create report from current content only'),
    },
  ];

  const toggleReport = (reportId: string, isWeekly: boolean) => {
    if (isWeekly) {
      const newSelection = selectedWeeklyReportIds.includes(reportId)
        ? selectedWeeklyReportIds.filter(id => id !== reportId)
        : [...selectedWeeklyReportIds, reportId];
      onWeeklyReportSelectionChange?.(newSelection);
    } else {
      const newSelection = selectedDailyReportIds.includes(reportId)
        ? selectedDailyReportIds.filter(id => id !== reportId)
        : [...selectedDailyReportIds, reportId];
      onDailyReportSelectionChange(newSelection);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSelectedIcon = () => {
    const type = reportTypes.find(r => r.value === selectedType);
    if (!type) return <FileText className="h-5 w-5 text-primary" />;
    const Icon = type.icon;
    return <Icon className="h-5 w-5 text-primary" />;
  };

  const showAggregationOptions = selectedType === 'weekly' || selectedType === 'monthly';
  const isMonthlyMode = selectedType === 'monthly';
  const currentReports = isMonthlyMode ? availableWeeklyReports : availableDailyReports;
  const currentSelectedIds = isMonthlyMode ? selectedWeeklyReportIds : selectedDailyReportIds;
  const isLoadingReports = isMonthlyMode ? isLoadingWeeklyReports : isLoadingDailyReports;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="rounded-xl bg-card border border-border/50"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {getSelectedIcon()}
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

          {/* Aggregation Options for Weekly/Monthly */}
          {showAggregationOptions && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground">
                {isMonthlyMode 
                  ? t('reportType.monthlySource', 'Include Weekly Reports')
                  : t('reportType.weeklySource', 'Include Daily Reports')
                }
              </h4>
              
              <RadioGroup
                value={weeklySourceMode}
                onValueChange={(value) => onWeeklySourceModeChange(value as WeeklySourceMode)}
                className="grid gap-2"
              >
                {sourceOptions.map((option) => {
                  const isSelected = weeklySourceMode === option.value;
                  
                  return (
                    <Label
                      key={option.value}
                      htmlFor={`source-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                      )}
                    >
                      <RadioGroupItem 
                        value={option.value} 
                        id={`source-${option.value}`} 
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </Label>
                  );
                })}
              </RadioGroup>

              {/* Manual Selection of Reports */}
              {weeklySourceMode === 'manual' && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isMonthlyMode 
                      ? t('reportType.selectWeeklyReports', 'Select Weekly Reports')
                      : t('reportType.selectDailyReports', 'Select Daily Reports')
                    }
                  </h5>
                  
                  {isLoadingReports ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : currentReports.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center bg-secondary/20 rounded-lg">
                      {isMonthlyMode 
                        ? t('reportType.noWeeklyReports', 'No weekly reports available')
                        : t('reportType.noDailyReports', 'No daily reports available')
                      }
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {currentReports.map((report) => {
                        const isChecked = currentSelectedIds.includes(report.id);
                        
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
                              onCheckedChange={() => toggleReport(report.id, isMonthlyMode)}
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
              {weeklySourceMode === 'auto' && currentReports.length > 0 && (
                <div className="text-xs text-muted-foreground bg-secondary/20 rounded-lg p-3">
                  {isMonthlyMode 
                    ? t('reportType.autoDetectMonthlyInfo', '{{count}} weekly report(s) from this month will be included', { count: currentReports.length })
                    : t('reportType.autoDetectInfo', '{{count}} daily report(s) from this week will be included', { count: currentReports.length })
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
