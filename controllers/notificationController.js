// backend/controllers/notificationController.js
const prisma = require("../utils/prismaClient");

const getPermissions = async (req) => {
  const role = await prisma.role.findUnique({ where: { name: req.staffUser.role } });
  return role?.permissions || [];
};

const hasPermissionOverlap = (notification, userPermissions) => {
  if (!notification.audience || !Array.isArray(notification.audience.permissions)) return false;
  return notification.audience.permissions.some(p => userPermissions.includes(p));
};

exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 200);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);

    const q = String(req.query.q || "").trim();
    const severity = String(req.query.severity || "").trim();
    const type = String(req.query.type || "").trim();

    const readState = req.query.read
      ? String(req.query.read).toLowerCase()
      : req.query.unread === "1"
        ? "unread"
        : "all";

    const permissions = await getPermissions(req);

    // Fetch all notifications matching basic criteria
    const whereClause = {};
    if (severity) whereClause.severity = severity;
    if (type) whereClause.type = { startsWith: type };
    if (q) {
      whereClause.OR = [
        { title: { contains: q } },
        { message: { contains: q } },
        { type: { contains: q } },
      ];
    }

    const allMatched = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    // Filter by permissions in memory
    const permissionFiltered = allMatched.filter(n => hasPermissionOverlap(n, permissions));
    const total = permissionFiltered.length;

    // Calculate unread total
    let unreadTotal = 0;
    permissionFiltered.forEach(n => {
      const readBy = Array.isArray(n.readBy) ? n.readBy : [];
      if (!readBy.includes(req.staffUser.id)) {
        unreadTotal++;
      }
    });

    // Filter by read state
    const stateFiltered = permissionFiltered.filter(n => {
      const readBy = Array.isArray(n.readBy) ? n.readBy : [];
      const isRead = readBy.includes(req.staffUser.id);
      
      if (readState === "unread") return !isRead;
      if (readState === "read") return isRead;
      return true;
    });

    // Paginate
    const skip = (page - 1) * limit;
    const items = stateFiltered.slice(skip, skip + limit);

    return res.json({ success: true, items, total, unreadTotal });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load notifications",
    });
  }
};

exports.markRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ success: true, modifiedCount: 0 });

    const permissions = await getPermissions(req);

    // Fetch candidate notifications
    const candidates = await prisma.notification.findMany({
      where: { id: { in: ids } }
    });

    let modifiedCount = 0;
    for (const notification of candidates) {
      if (hasPermissionOverlap(notification, permissions)) {
        const readBy = Array.isArray(notification.readBy) ? [...notification.readBy] : [];
        if (!readBy.includes(req.staffUser.id)) {
          readBy.push(req.staffUser.id);
          await prisma.notification.update({
            where: { id: notification.id },
            data: { readBy: readBy }
          });
          modifiedCount++;
        }
      }
    }

    return res.json({
      success: true,
      modifiedCount,
      matchedCount: candidates.length,
    });
  } catch (err) {
    console.error("markRead error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to mark read",
    });
  }
};

// Mark all unread notifications as read (respecting current filters except read-state)
exports.markAllRead = async (req, res) => {
  try {
    const q = String(req.body?.q || "").trim();
    const severity = String(req.body?.severity || "").trim();
    const type = String(req.body?.type || "").trim();

    const permissions = await getPermissions(req);

    const whereClause = {};
    if (severity) whereClause.severity = severity;
    if (type) whereClause.type = { startsWith: type };
    if (q) {
      whereClause.OR = [
        { title: { contains: q } },
        { message: { contains: q } },
        { type: { contains: q } },
      ];
    }

    const allMatched = await prisma.notification.findMany({ where: whereClause });

    let modifiedCount = 0;
    let matchedCount = 0;
    for (const notification of allMatched) {
      if (hasPermissionOverlap(notification, permissions)) {
        matchedCount++;
        const readBy = Array.isArray(notification.readBy) ? [...notification.readBy] : [];
        if (!readBy.includes(req.staffUser.id)) {
          readBy.push(req.staffUser.id);
          await prisma.notification.update({
            where: { id: notification.id },
            data: { readBy: readBy }
          });
          modifiedCount++;
        }
      }
    }

    return res.json({
      success: true,
      modifiedCount,
      matchedCount,
    });
  } catch (err) {
    console.error("markAllRead error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to mark all as read",
    });
  }
};

// Delete one notification
exports.deleteNotification = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    const permissions = await getPermissions(req);

    const notification = await prisma.notification.findUnique({ where: { id } });
    
    if (!notification || !hasPermissionOverlap(notification, permissions)) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await prisma.notification.delete({ where: { id } });

    return res.json({
      success: true,
      message: "Notification deleted",
      deletedCount: 1,
      deletedIds: [id],
    });
  } catch (err) {
    console.error("deleteNotification error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
};

// Bulk delete notifications by selected IDs
exports.deleteNotificationsBulk = async (req, res) => {
  try {
    const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (!incomingIds.length) {
      return res.status(400).json({
        success: false,
        message: "ids[] is required",
      });
    }

    const validIds = [...new Set(incomingIds.map((id) => String(id).trim()).filter(Boolean))];

    const permissions = await getPermissions(req);

    const candidates = await prisma.notification.findMany({
      where: { id: { in: validIds } }
    });

    const deletableIds = candidates
      .filter(n => hasPermissionOverlap(n, permissions))
      .map(n => n.id);

    const notFoundIds = validIds.filter(id => !deletableIds.includes(id));

    if (!deletableIds.length) {
      return res.status(404).json({
        success: false,
        message: "No matching notifications found",
        invalidIds: [],
        notFoundIds: validIds,
      });
    }

    const result = await prisma.notification.deleteMany({
      where: { id: { in: deletableIds } }
    });

    return res.json({
      success: true,
      message: `Deleted ${result.count || 0} notification(s)`,
      deletedCount: result.count || 0,
      deletedIds: deletableIds,
      invalidIds: [],
      notFoundIds,
    });
  } catch (err) {
    console.error("deleteNotificationsBulk error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to bulk delete notifications",
    });
  }
};

module.exports = exports;
