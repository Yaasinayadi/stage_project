export interface FinancialMetrics {
  resourcesCost: number;
  laborCost: number;
  grandTotal: number;
  tva: number;
  totalTtc: number;
  netMinutes: number;
  totalElapsedMinutes: number;
  pausedMinutes: number;
}

export function calculateTicketFinancials(ticket: any, timelineData?: any): FinancialMetrics {
  const parseDateSafe = (dStr: string | null | undefined) => {
    if (!dStr) return 0;
    return new Date(dStr.endsWith("Z") ? dStr : dStr + "Z").getTime();
  };

  const createdDate = parseDateSafe(ticket.create_date);
  const endDate =
    (ticket.state === "resolved" || ticket.state === "closed") && ticket.date_resolved
      ? parseDateSafe(ticket.date_resolved)
      : Date.now();

  let totalElapsedMinutes = 0;
  if (createdDate && endDate) {
    totalElapsedMinutes = (endDate - createdDate) / 60000;
  }

  const actualPausedHoursRaw =
    timelineData?.actual_paused_hours ?? ticket.x_actual_paused_duration ?? null;

  let pausedMinutes = 0;
  if (actualPausedHoursRaw !== null) {
    pausedMinutes = actualPausedHoursRaw * 60;
  } else {
    const pausedHoursRaw =
      timelineData?.total_paused_hours ?? ticket.x_total_paused_duration ?? 0;
    pausedMinutes = pausedHoursRaw * 60;
    pausedMinutes = Math.min(pausedMinutes, totalElapsedMinutes);
  }

  const netMinutes = Math.max(0, totalElapsedMinutes - pausedMinutes);

  const DEFAULT_HOURLY_RATE = 150;
  const hourlyRate = ticket.hourly_rate || DEFAULT_HOURLY_RATE;

  // Use net minutes; minimum 1 minute of work
  const netHoursCalc = Math.max(netMinutes, 1) / 60;
  const laborCost = netHoursCalc * hourlyRate;

  const resourcesCost = ticket.total_material_cost || 0;
  const grandTotal = resourcesCost + laborCost;
  const tva = grandTotal * 0.20;
  const totalTtc = grandTotal + tva;

  return {
    resourcesCost,
    laborCost,
    grandTotal,
    tva,
    totalTtc,
    netMinutes,
    totalElapsedMinutes,
    pausedMinutes,
  };
}
