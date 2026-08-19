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

function findMinimumCostFlowAssignments(scheduleMap, options, dateString, dates) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const members = [];
  const memberIndexById = new Map();
  options.forEach((option) => {
    option.candidates.forEach((member) => {
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
      const memberNode = memberStart + memberIndexById.get(member.id);
      const edge = addEdge(
        shiftNode,
        memberNode,
        1,
        getDailyAssignmentCost(scheduleMap, option, member, dateString, dates)
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

function findConstraintAwareDailyShiftAssignments(scheduleMap, options, dateString, dates) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const shiftSlots = [];
  options.forEach((option) => {
    for (let index = 0; index < option.remaining; index += 1) {
      shiftSlots.push({
        ...option,
        slotCost: option.assignedCount === 0 && index === 0 ? FIRST_COVERAGE_COST : EXTRA_COVERAGE_COST
      });
    }
  });

  let bestAssignments = [];
  let bestCost = Infinity;
  const currentAssignments = [];
  const usedMembers = new Set();
  const blockedById = new Map();

  const search = (slotIndex, cost) => {
    if (currentAssignments.length + (shiftSlots.length - slotIndex) < bestAssignments.length) {
      return;
    }
    if (slotIndex >= shiftSlots.length) {
      if (
        currentAssignments.length > bestAssignments.length
        || (currentAssignments.length === bestAssignments.length && cost < bestCost)
      ) {
        bestAssignments = currentAssignments.map((item) => ({ shift: item.shift, member: item.member }));
        bestCost = cost;
      }
      return;
    }

    const option = shiftSlots[slotIndex];
    const candidates = option.candidates
      .filter((member) => !usedMembers.has(member.id))
      .map((member) => ({
        member,
        cost: option.slotCost + getDailyAssignmentCost(scheduleMap, option, member, dateString, dates)
      }))
      .sort((a, b) => a.cost - b.cost || a.member.name.localeCompare(b.member.name));

    candidates.forEach(({ member, cost: assignmentCost }) => {
      const blocking = getBlockingSameShiftConditions(scheduleMap, member.id, option.shift.id, dateString);
      if (blocking.length) {
        blocking.forEach((condition) => blockedById.set(condition.id, condition));
        return;
      }
      const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
      if (!slot) return;
      const previousShift = slot.shift || null;
      slot.shift = option.shift.id;
      usedMembers.add(member.id);
      currentAssignments.push({ shift: option.shift, member });
      search(slotIndex + 1, cost + assignmentCost);
      currentAssignments.pop();
      usedMembers.delete(member.id);
      slot.shift = previousShift;
    });

    search(slotIndex + 1, cost);
  };

  search(0, 0);
  return {
    assignments: bestAssignments,
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
