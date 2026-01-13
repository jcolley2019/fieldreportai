import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface MetricRow {
  id: string;
  function_name: string;
  primary_model: string;
  model_used: string;
  used_fallback: boolean;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface AggregatedMetric {
  date: string;
  totalCalls: number;
  fallbackCalls: number;
  fallbackRate: number;
  avgLatency: number;
  errorCount: number;
}

interface FunctionMetric {
  function_name: string;
  totalCalls: number;
  fallbackCalls: number;
  fallbackRate: number;
  avgLatency: number;
  errorRate: number;
}

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  destructive: "hsl(var(--destructive))",
  muted: "hsl(var(--muted))",
  accent: "hsl(var(--accent))",
};

const PIE_COLORS = ["#22c55e", "#f97316", "#ef4444"];

export default function AdminMetrics() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [timeRange, setTimeRange] = useState("7");
  const [selectedFunction, setSelectedFunction] = useState<string>("all");

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roles) {
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    };

    checkAdmin();
  }, [navigate]);

  // Fetch metrics data
  useEffect(() => {
    if (!isAdmin) return;

    const fetchMetrics = async () => {
      setLoading(true);
      const startDate = startOfDay(subDays(new Date(), parseInt(timeRange)));
      
      const { data, error } = await supabase
        .from("ai_metrics")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching metrics:", error);
      } else {
        setMetrics(data || []);
      }
      setLoading(false);
    };

    fetchMetrics();
  }, [isAdmin, timeRange]);

  // Filter metrics by selected function
  const filteredMetrics = selectedFunction === "all" 
    ? metrics 
    : metrics.filter(m => m.function_name === selectedFunction);

  // Get unique function names
  const functionNames = [...new Set(metrics.map(m => m.function_name))];

  // Aggregate metrics by day
  const dailyMetrics: AggregatedMetric[] = [];
  const metricsByDay = new Map<string, MetricRow[]>();

  filteredMetrics.forEach(metric => {
    const day = format(new Date(metric.created_at), "yyyy-MM-dd");
    if (!metricsByDay.has(day)) {
      metricsByDay.set(day, []);
    }
    metricsByDay.get(day)!.push(metric);
  });

  metricsByDay.forEach((dayMetrics, date) => {
    const fallbackCalls = dayMetrics.filter(m => m.used_fallback).length;
    const errorCount = dayMetrics.filter(m => m.status === "error").length;
    const latencies = dayMetrics.filter(m => m.latency_ms !== null).map(m => m.latency_ms!);
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) 
      : 0;

    dailyMetrics.push({
      date: format(new Date(date), "MMM d"),
      totalCalls: dayMetrics.length,
      fallbackCalls,
      fallbackRate: Math.round((fallbackCalls / dayMetrics.length) * 100),
      avgLatency,
      errorCount,
    });
  });

  // Sort by date
  dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate function-level metrics
  const functionMetrics: FunctionMetric[] = functionNames.map(fn => {
    const fnMetrics = metrics.filter(m => m.function_name === fn);
    const fallbackCalls = fnMetrics.filter(m => m.used_fallback).length;
    const errorCalls = fnMetrics.filter(m => m.status === "error").length;
    const latencies = fnMetrics.filter(m => m.latency_ms !== null).map(m => m.latency_ms!);
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) 
      : 0;

    return {
      function_name: fn.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      totalCalls: fnMetrics.length,
      fallbackCalls,
      fallbackRate: fnMetrics.length > 0 ? Math.round((fallbackCalls / fnMetrics.length) * 100) : 0,
      avgLatency,
      errorRate: fnMetrics.length > 0 ? Math.round((errorCalls / fnMetrics.length) * 100) : 0,
    };
  });

  // Overall stats
  const totalCalls = filteredMetrics.length;
  const totalFallbacks = filteredMetrics.filter(m => m.used_fallback).length;
  const totalErrors = filteredMetrics.filter(m => m.status === "error").length;
  const allLatencies = filteredMetrics.filter(m => m.latency_ms !== null).map(m => m.latency_ms!);
  const overallAvgLatency = allLatencies.length > 0 
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length) 
    : 0;

  // Pie chart data
  const statusDistribution = [
    { name: "Success (Primary)", value: totalCalls - totalFallbacks - totalErrors },
    { name: "Success (Fallback)", value: totalFallbacks },
    { name: "Errors", value: totalErrors },
  ].filter(d => d.value > 0);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">AI Metrics Dashboard</h1>
              <p className="text-muted-foreground">Monitor AI function performance and fallback rates</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">Admin Only</Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {functionNames.map(fn => (
                <SelectItem key={fn} value={fn}>
                  {fn.replace(/-/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No metrics data yet</h3>
              <p className="text-muted-foreground">
                Metrics will appear here once AI functions are called with LOG_AI_METRICS enabled.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Last {timeRange} {timeRange === "1" ? "day" : "days"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Fallback Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalCalls > 0 ? ((totalFallbacks / totalCalls) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalFallbacks} fallback{totalFallbacks !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallAvgLatency.toLocaleString()}ms</div>
                  <p className="text-xs text-muted-foreground">
                    Response time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalErrors} error{totalErrors !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              {/* Latency Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Latency Trend</CardTitle>
                  <CardDescription>Average response time over time (ms)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avgLatency" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))" }}
                          name="Avg Latency (ms)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Fallback Rate Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Fallback Rate Trend</CardTitle>
                  <CardDescription>Percentage of calls using fallback model</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="fallbackRate" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          dot={{ fill: "#f97316" }}
                          name="Fallback Rate (%)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              {/* Call Volume */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Call Volume</CardTitle>
                  <CardDescription>Number of AI calls per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }} 
                        />
                        <Bar 
                          dataKey="totalCalls" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name="Total Calls"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Breakdown of call outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }} 
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Function Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle>Function Performance</CardTitle>
                <CardDescription>Metrics breakdown by AI function</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Function</th>
                        <th className="text-right py-3 px-4 font-medium">Calls</th>
                        <th className="text-right py-3 px-4 font-medium">Fallback Rate</th>
                        <th className="text-right py-3 px-4 font-medium">Avg Latency</th>
                        <th className="text-right py-3 px-4 font-medium">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {functionMetrics.map((fn) => (
                        <tr key={fn.function_name} className="border-b last:border-0">
                          <td className="py-3 px-4">{fn.function_name}</td>
                          <td className="text-right py-3 px-4">{fn.totalCalls.toLocaleString()}</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant={fn.fallbackRate > 10 ? "destructive" : fn.fallbackRate > 0 ? "secondary" : "outline"}>
                              {fn.fallbackRate}%
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4">{fn.avgLatency.toLocaleString()}ms</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant={fn.errorRate > 5 ? "destructive" : fn.errorRate > 0 ? "secondary" : "outline"}>
                              {fn.errorRate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
