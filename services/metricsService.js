'use strict';

const { Op } = require('sequelize');
const { EtimsInvoice, MpesaCallbackEvent, AuthSession } = require('../models');

const durationBuckets = [25, 50, 100, 250, 500, 1000, 2500, 5000];
const requests = new Map();
const durations = new Map();
let activeRequests = 0;

function normalizeRoute(req) {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}` || '/';
  return '/unmatched';
}

function increment(map, key, amount = 1) {
  map.set(key, Number(map.get(key) || 0) + amount);
}

function beginRequest() {
  activeRequests += 1;
}

function recordRequest(req, status, durationMs) {
  activeRequests = Math.max(0, activeRequests - 1);
  const route = normalizeRoute(req);
  const requestedMethod = String(req.method || 'UNKNOWN').toUpperCase();
  const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(requestedMethod)
    ? requestedMethod
    : 'OTHER';
  const statusCode = String(status || 0);
  const key = JSON.stringify([method, route, statusCode]);
  increment(requests, key);

  const durationKey = JSON.stringify([method, route]);
  const current = durations.get(durationKey) || {
    count: 0,
    sumMs: 0,
    buckets: durationBuckets.map(() => 0),
    infinity: 0
  };
  current.count += 1;
  current.sumMs += Number(durationMs || 0);
  current.infinity += 1;
  durationBuckets.forEach((bucket, index) => {
    if (durationMs <= bucket) current.buckets[index] += 1;
  });
  durations.set(durationKey, current);
}

function escapeLabel(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function labels(values) {
  return Object.entries(values).map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',');
}

async function operationalGauges() {
  const [queuedEtims, failedEtims, unresolvedMpesa, activeSessions] = await Promise.all([
    EtimsInvoice.count({ where: { status: { [Op.in]: ['queued', 'retrying'] } } }),
    EtimsInvoice.count({ where: { status: 'failed' } }),
    MpesaCallbackEvent.count({ where: { status: { [Op.in]: ['unmatched', 'exception', 'error'] } } }),
    AuthSession.count({ where: { revokedAt: null, expiresAt: { [Op.gt]: new Date() } } })
  ]);
  return { queuedEtims, failedEtims, unresolvedMpesa, activeSessions };
}

async function renderPrometheus(gaugeOverride = null) {
  const memory = process.memoryUsage();
  const gauges = gaugeOverride || await operationalGauges();
  const lines = [
    '# HELP jijenge_process_uptime_seconds Process uptime in seconds.',
    '# TYPE jijenge_process_uptime_seconds gauge',
    `jijenge_process_uptime_seconds ${process.uptime().toFixed(3)}`,
    '# HELP jijenge_process_resident_memory_bytes Resident process memory.',
    '# TYPE jijenge_process_resident_memory_bytes gauge',
    `jijenge_process_resident_memory_bytes ${memory.rss}`,
    '# HELP jijenge_http_active_requests Requests currently being processed.',
    '# TYPE jijenge_http_active_requests gauge',
    `jijenge_http_active_requests ${activeRequests}`,
    '# HELP jijenge_http_requests_total Completed HTTP requests.',
    '# TYPE jijenge_http_requests_total counter'
  ];

  for (const [key, count] of requests) {
    const [method, route, status] = JSON.parse(key);
    lines.push(`jijenge_http_requests_total{${labels({ method, route, status })}} ${count}`);
  }

  lines.push(
    '# HELP jijenge_http_request_duration_ms HTTP request duration in milliseconds.',
    '# TYPE jijenge_http_request_duration_ms histogram'
  );
  for (const [key, metric] of durations) {
    const [method, route] = JSON.parse(key);
    durationBuckets.forEach((bucket, index) => {
      lines.push(`jijenge_http_request_duration_ms_bucket{${labels({ method, route, le: bucket })}} ${metric.buckets[index]}`);
    });
    lines.push(`jijenge_http_request_duration_ms_bucket{${labels({ method, route, le: '+Inf' })}} ${metric.infinity}`);
    lines.push(`jijenge_http_request_duration_ms_sum{${labels({ method, route })}} ${metric.sumMs.toFixed(3)}`);
    lines.push(`jijenge_http_request_duration_ms_count{${labels({ method, route })}} ${metric.count}`);
  }

  const operational = {
    jijenge_etims_pending_invoices: gauges.queuedEtims,
    jijenge_etims_failed_invoices: gauges.failedEtims,
    jijenge_mpesa_unresolved_callbacks: gauges.unresolvedMpesa,
    jijenge_active_auth_sessions: gauges.activeSessions
  };
  for (const [name, value] of Object.entries(operational)) {
    lines.push(`# TYPE ${name} gauge`, `${name} ${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function resetMetricsForTests() {
  requests.clear();
  durations.clear();
  activeRequests = 0;
}

module.exports = { beginRequest, recordRequest, renderPrometheus, resetMetricsForTests };
