const TaskAssignment = require("../../models/taskAssignmentModel");

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const t = String(value).trim();
  return t.length ? t : undefined;
};

const createTask = async (req, res) => {
  try {
    const payload = {
      title: req.body?.title,
      description: req.body?.description,
      noteToAssignee: req.body?.noteToAssignee || req.body?.note,
      startDate: req.body?.startDate || req.body?.start,
      dueDate: req.body?.dueDate || req.body?.end,
      durationDays:
        toNumber(req.body?.durationDays) ?? toNumber(req.body?.duration),
      priority: req.body?.priority,
      status: req.body?.status,
      assigneeId: toNumber(req.body?.assigneeId || req.body?.assignee),
      createdById: req.userId,
    };

    const task = await TaskAssignment.createTask(payload);
    const workload = await TaskAssignment.countActiveTasksForAssignee(
      payload.assigneeId
    );

    res.status(201).json({
      data: task,
      assigneeActiveTasks: workload,
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    console.error("create task error", err);
    res.status(500).json({ message: "ไม่สามารถมอบหมายงานได้" });
  }
};

const listTasks = async (req, res) => {
  try {
    const isOwner = req.userRole === "OWNER";
    const filters = { ...(req.query || {}) };

    // Non-owners should only see tasks assigned to themselves.
    if (!isOwner) {
      filters.assigneeId = req.userId;
    }

    const tasks = await TaskAssignment.listTasks(filters);
    res.json({ data: tasks });
  } catch (err) {
    console.error("list task error", err);
    res.status(500).json({ message: "ไม่สามารถดึงรายการงานได้" });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const updated = await TaskAssignment.updateTaskStatus({
      id: req.params.id,
      requesterId: req.userId,
      requesterRole: req.userRole,
      status: req.body?.status,
      submissionNote: normalizeString(req.body?.submissionNote ?? req.body?.note),
    });
    res.json({ data: updated });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    if (err.code === "FORBIDDEN") {
      return res.status(403).json({ message: err.message });
    }
    console.error("update task status error", err);
    res.status(500).json({ message: "ไม่สามารถอัปเดตงานได้" });
  }
};

const deleteTask = async (req, res) => {
  try {
    const result = await TaskAssignment.deleteTask(req.params.id);
    res.status(200).json({ message: "ลบงานสำเร็จ", data: result });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: err.message });
    }
    console.error("delete task error", err);
    res.status(500).json({ message: "ไม่สามารถลบงานได้" });
  }
};

module.exports = {
  createTask,
  listTasks,
  updateTaskStatus,
  deleteTask,
};
