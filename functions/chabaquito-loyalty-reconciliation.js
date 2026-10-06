"use strict";

function shouldReconcileLoyaltyVisit(beforeVisit, afterVisit, requestId) {
  const id = String(requestId || "").trim();
  if (!id || !afterVisit || !afterVisit.userId) return false;

  const afterStatus = String(afterVisit.status || "").trim();
  if (!["confirmed", "reversed"].includes(afterStatus)) return false;

  const beforeStatus = beforeVisit ? String(beforeVisit.status || "").trim() : "";
  return beforeStatus !== afterStatus;
}

module.exports = { shouldReconcileLoyaltyVisit };
