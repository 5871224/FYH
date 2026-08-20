const AUTO_SCHEDULE_CONSTRAINT_MAX_REPAIR_ATTEMPTS = 24;
const AUTO_SCHEDULE_CONSTRAINT_MAX_REPAIR_CANDIDATES = 6;

function getDailyAssignmentCost(scheduleMap, option, member, dateString, dates) {
  const weekIndex = getWeekBucketIndex(dateString, dates[0] || dateString);
  const restTarget = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  const restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
  const hasRestThisWeek = memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, dates[0] || dateString);
  const shiftPriority = getMemberShiftPriority(member, option.shift.id);
  const mustWork = !member.payByDay && (restCount >= restTarget || hasRestThisWeek);
  if (mustWork) {
    return shiftPriority;
  }
  if (!member.payByDay) {
    return 1000 + shiftPriority;
  }
  return 2000 + shiftPriority;
}

function getAutoScheduleAssignmentKey(shiftId, memberId) {
  return `${shiftId}|${memberId}`;
}

function getCachedDailyAssignmentCost(scheduleMap, option, member, dateString, dates, cache) {
  if (!cache) return getDailyAssignmentCost(scheduleMap, option, member, dateString, dates);
  const key = getAutoScheduleAssignmentKey(option.shift.id, member.id);
  if (!cache.has(key)) cache.set(key, getDailyAssignmentCost(scheduleMap, option, member, dateString, dates));
  return cache.get(key);
}

function findMinimumCostFlowAssignments(
  scheduleMap,
  options,
  dateString,
  dates,
  forbiddenAssignmentKeys = null,
  assignmentCostCache = null
) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const members = [];
  const memberIndexById = new Map();
  options.forEach((option) => {
    option.candidates.forEach((member) => {
      if (forbiddenAssignmentKeys?.has(getAutoScheduleAssignmentKey(option.shift.id, member.id))) return;
      if (!memberIndexById.has(member.id)) {
        memberIndexById.set(member.id, members.length);
        members.push(member);
      }
    });
  });
  const shiftSlots = [];
  options.forEach((option) => {
    for (let index = 0; index < option.remaining; index += 1) {
      shiftSlots.push({
        ...option,
        slotCost: option.assignedCount === 0 && index === 0 ? FIRST_COVERAGE_COST : EXTRA_COVERAGE_COST
      });
    }
  });
  const source = 0;
  const shiftStart = 1;
  const memberStart = shiftStart + shiftSlots.length;
  const sink = memberStart + members.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const assignmentEdges = [];
  const addEdge = (from, to, capacity, cost = 0) => {
    const forward = { to, rev: graph[to].length, capacity, cost };
    const backward = { to: from, rev: graph[from].length, capacity: 0, cost: -cost };
    graph[from].push(forward);
    graph[to].push(backward);
    return forward;
  };
  shiftSlots.forEach((option, optionIndex) => {
    const shiftNode = shiftStart + optionIndex;
    addEdge(source, shiftNode, 1, option.slotCost);
    option.candidates.forEach((member) => {
      const assignmentKey = getAutoScheduleAssignmentKey(option.shift.id, member.id);
      if (forbiddenAssignmentKeys?.has(assignmentKey)) return;
      const memberIndex = memberIndexById.get(member.id);
      if (memberIndex === undefined) return;
      const memberNode = memberStart + memberIndex;
      const edge = addEdge(
        shiftNode,
        memberNode,
        1,
        getCachedDailyAssignmentCost(scheduleMap, option, member, dateString, dates, assignmentCostCache)
      );
      assignmentEdges.push({ edge, shift: option.shift, member });
    });
  });
  members.forEach((member, memberIndex) => {
    addEdge(memberStart + memberIndex, sink, 1);
  });
  const findShortestPath = () => {
    const distances = Array(graph.length).fill(Infinity);
    const inQueue = Array(graph.length).fill(false);
    const previous = Array(graph.length).fill(null);
    distances[source] = 0;
    const queue = [source];
    inQueue[source] = true;
    while (queue.length) {
      const node = queue.shift();
      inQueue[node] = false;
      graph[node].forEach((edge, edgeIndex) => {
        const nextCost = distances[node] + edge.cost;
        if (edge.capacity > 0 && nextCost < distances[edge.to]) {
          distances[edge.to] = nextCost;
          previous[edge.to] = { node, edgeIndex };
          if (!inQueue[edge.to]) {
            inQueue[edge.to] = true;
            queue.push(edge.to);
          }
        }
      });
    }
    return distances[sink] < Infinity ? previous : null;
  };
  // ponytail: daily graph is tiny; min-cost max-flow keeps full coverage while honoring priority costs.
  while (true) {
    const previous = findShortestPath();
    if (!previous) {
      break;
    }
    let cursor = sink;
    while (cursor !== source) {
      const step = previous[cursor];
      const edge = graph[step.node][step.edgeIndex];
      edge.capacity -= 1;
      graph[edge.to][edge.rev].capacity += 1;
      cursor = step.node;
    }
  }
  return assignmentEdges
    .filter(({ edge }) => edge.capacity === 0)
    .map(({ shift, member }) => ({ shift, member }));
}

function inspectSameShiftConstraintViolations(scheduleMap, assignments, dateString, conditions) {
  const assignmentByMemberId = new Map(assignments.map((assignment) => [assignment.member.id, assignment]));
  const violations = [];
  const blockedById = new Map();
  let excess = 0;

  conditions.forEach((condition) => {
    const baselineCountByShift = new Map();
    const finalMemberIdsByShift = new Map();

    condition.effectiveMemberIds.forEach((memberId) => {
      const baselineShiftId = getWorkScheduleSlot(scheduleMap, memberId, dateString)?.shift || "";
      if (baselineShiftId) {
        baselineCountByShift.set(baselineShiftId, (baselineCountByShift.get(baselineShiftId) || 0) + 1);
      }
      const finalShiftId = assignmentByMemberId.get(memberId)?.shift?.id || baselineShiftId;
      if (!finalShiftId) return;
      if (!finalMemberIdsByShift.has(finalShiftId)) finalMemberIdsByShift.set(finalShiftId, []);
      finalMemberIdsByShift.get(finalShiftId).push(memberId);
    });

    finalMemberIdsByShift.forEach((memberIds, shiftId) => {
      const baselineCount = baselineCountByShift.get(shiftId) || 0;
      // 人工修改可以違反條件；自動排班只保證不讓既有違反程度繼續增加。
      const allowedCount = Math.max(condition.limitCount, baselineCount);
      if (memberIds.length <= allowedCount) return;
      const violationExcess = memberIds.length - allowedCount;
      const autoAssignments = memberIds.map((memberId) => assignmentByMemberId.get(memberId)).filter(Boolean);
      if (!autoAssignments.length) return;
      violations.push({ condition, shiftId, excess: violationExcess, assignments: autoAssignments });
      excess += violationExcess;
      blockedById.set(condition.id, condition);
    });
  });

  return { violations, excess, blockedConditions: Array.from(blockedById.values()) };
}

function getConstraintRepairCandidates(inspection) {
  const candidates = new Map();
  inspection.violations.forEach((violation) => {
    violation.assignments.forEach((assignment) => {
      const key = getAutoScheduleAssignmentKey(assignment.shift.id, assignment.member.id);
      if (!candidates.has(key)) candidates.set(key, assignment);
    });
  });
  return Array.from(candidates.entries())
    .sort(([, a], [, b]) => a.member.name.localeCompare(b.member.name) || a.shift.name.localeCompare(b.shift.name))
    .slice(0, AUTO_SCHEDULE_CONSTRAINT_MAX_REPAIR_CANDIDATES);
}

function getAssignmentSetCost(scheduleMap, options, assignments, dateString, dates, assignmentCostCache) {
  const optionByShiftId = new Map(options.map((option) => [option.shift.id, option]));
  return assignments.reduce((sum, assignment) => {
    const option = optionByShiftId.get(assignment.shift.id);
    if (!option) return sum;
    return sum + getCachedDailyAssignmentCost(
      scheduleMap,
      option,
      assignment.member,
      dateString,
      dates,
      assignmentCostCache
    );
  }, 0);
}

function compareConstraintRepairScores(a, b) {
  if (a.excess !== b.excess) return a.excess - b.excess;
  if (a.coverage !== b.coverage) return b.coverage - a.coverage;
  return a.cost - b.cost;
}

function findConstraintAwareDailyShiftAssignments(scheduleMap, options, dateString, dates) {
  const sameShiftConditions = getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_SHIFT);
  const forbiddenAssignmentKeys = new Set();
  const assignmentCostCache = new Map();
  const blockedById = new Map();
  let assignments = findMinimumCostFlowAssignments(
    scheduleMap,
    options,
    dateString,
    dates,
    forbiddenAssignmentKeys,
    assignmentCostCache
  );
  let inspection = inspectSameShiftConstraintViolations(scheduleMap, assignments, dateString, sameShiftConditions);

  const scoreCurrent = () => ({
    excess: inspection.excess,
    coverage: assignments.length,
    cost: getAssignmentSetCost(scheduleMap, options, assignments, dateString, dates, assignmentCostCache)
  });

  for (let attempt = 0; attempt < AUTO_SCHEDULE_CONSTRAINT_MAX_REPAIR_ATTEMPTS && inspection.excess > 0; attempt += 1) {
    inspection.blockedConditions.forEach((condition) => blockedById.set(condition.id, condition));
    const currentScore = scoreCurrent();
    let bestTrial = null;

    getConstraintRepairCandidates(inspection).forEach(([assignmentKey]) => {
      if (forbiddenAssignmentKeys.has(assignmentKey)) return;
      const trialForbiddenKeys = new Set(forbiddenAssignmentKeys);
      trialForbiddenKeys.add(assignmentKey);
      const trialAssignments = findMinimumCostFlowAssignments(
        scheduleMap,
        options,
        dateString,
        dates,
        trialForbiddenKeys,
        assignmentCostCache
      );
      const trialInspection = inspectSameShiftConstraintViolations(
        scheduleMap,
        trialAssignments,
        dateString,
        sameShiftConditions
      );
      const trialScore = {
        excess: trialInspection.excess,
        coverage: trialAssignments.length,
        cost: getAssignmentSetCost(scheduleMap, options, trialAssignments, dateString, dates, assignmentCostCache)
      };
      if (!bestTrial || compareConstraintRepairScores(trialScore, bestTrial.score) < 0) {
        bestTrial = { assignmentKey, assignments: trialAssignments, inspection: trialInspection, score: trialScore };
      }
    });

    if (!bestTrial || compareConstraintRepairScores(bestTrial.score, currentScore) >= 0) break;
    forbiddenAssignmentKeys.add(bestTrial.assignmentKey);
    assignments = bestTrial.assignments;
    inspection = bestTrial.inspection;
  }

  // 有上限的局部修正仍無法找到合法解時，僅移除衝突的自動班別並保留缺額；硬性條件不可被突破。
  let fallbackGuard = options.reduce((sum, option) => sum + option.remaining, 0) + 1;
  while (inspection.excess > 0 && fallbackGuard > 0) {
    inspection.blockedConditions.forEach((condition) => blockedById.set(condition.id, condition));
    const fallbackCandidates = getConstraintRepairCandidates(inspection);
    if (!fallbackCandidates.length) break;
    const [, assignmentToRemove] = fallbackCandidates[fallbackCandidates.length - 1];
    const removeKey = getAutoScheduleAssignmentKey(assignmentToRemove.shift.id, assignmentToRemove.member.id);
    assignments = assignments.filter((assignment) => getAutoScheduleAssignmentKey(assignment.shift.id, assignment.member.id) !== removeKey);
    inspection = inspectSameShiftConstraintViolations(scheduleMap, assignments, dateString, sameShiftConditions);
    fallbackGuard -= 1;
  }

  inspection.blockedConditions.forEach((condition) => blockedById.set(condition.id, condition));
  return {
    assignments,
    blockedConditions: Array.from(blockedById.values())
  };
}

function findBestDailyShiftAssignments(scheduleMap, dateString, preview) {
  const options = getDailyShiftNeedOptions(scheduleMap, dateString)
    .sort((a, b) => (
      a.candidates.length - b.candidates.length
      || b.remaining - a.remaining
      || a.shift.name.localeCompare(b.shift.name)
    ));
  const sameShiftConditions = getEffectiveScheduleConditions(SCHEDULE_CONDITION_SAME_SHIFT);
  const conditionResult = sameShiftConditions.length
    ? findConstraintAwareDailyShiftAssignments(scheduleMap, options, dateString, preview.dates || [dateString])
    : {
      assignments: findMinimumCostFlowAssignments(scheduleMap, options, dateString, preview.dates || [dateString]),
      blockedConditions: []
    };
  const assignments = conditionResult.assignments;
  assignments.forEach(({ shift, member }) => {
    const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (slot) {
      slot.shift = shift.id;
    }
  });
  const missingDetails = getRemainingDailyShiftDemandDetails(scheduleMap, dateString);
  if (missingDetails.length) {
    if (conditionResult.blockedConditions.length) {
      noteScheduleConditionBlocks(preview, dateString, conditionResult.blockedConditions, "已達同班限額，無法再安排");
    }
    const missing = missingDetails.reduce((sum, item) => sum + item.missing, 0);
    const detailText = missingDetails
      .map(({ shift, missing: missingCount }) => `${shift.name}缺${missingCount}`)
      .join("、");
    preview.warnings.push(`${dateString} 仍缺 ${missing} 個班別人力${detailText ? `（${detailText}）` : ""}`);
  }
  return assignments;
}
