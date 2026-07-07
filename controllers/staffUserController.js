const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");
const { createNotification } = require("../utils/notificationService");
const {
  STAFF_AUTH_COOKIE_NAME,
  getStaffAuthCookieOptions,
} = require("../utils/staffAuthCookie");

// Admin creates a user (optionally assign roles)
exports.adminCreateStaffUser = async (req, res) => {
  const { email, password, role } = req.body;

  const existingUser = await prisma.staffUser.findUnique({ where: { email } });
  if (existingUser) return res.status(400).json({ error: "Email exists" });

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  const user = await prisma.staffUser.create({
    data: {
      email,
      password: passwordHash,
      role,
      status: "active",
    }
  });

  await createNotification({
    type: "staff.user.created",
    title: "Staff user created",
    message: `Staff user ${user.email} created`,
    severity: "critical",
    actor: {
      kind: "staff",
      id: req.staffUser?.id,
      email: req.staffUser?.email,
    },
    target: { kind: "staff", id: user.id, label: user.email },
    audience: { permissions: ["team:read"] },
  });

  return res.status(201).json(user);
};

// Admin update user basic fields (not password here)
exports.adminUpdateStaffUser = async (req, res) => {
  const targetId = req.params.id;
  const { email, status, role } = req.body;
  
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } });
  if (!target) return res.status(404).json({ error: "Not found" });

  if (target.isProtected) {
    return res.status(403).json({ error: "Cannot modify protected user" });
  }

  let updateData = {};
  if (email) updateData.email = email;
  if (status) updateData.status = status;
  if (role) updateData.role = role;
  updateData.tokenVersion = (target.tokenVersion || 0) + 1;

  const updatedTarget = await prisma.staffUser.update({
    where: { id: target.id },
    data: updateData
  });

  await createNotification({
    type: "staff.user.update",
    title: "Staff user updated",
    message: `${updatedTarget.email} is Updated.`,
    severity: "high",
    actor: {
      kind: "staff",
      id: req.staffUser?.id,
      email: req.staffUser?.email,
    },
    target: { kind: "staff", id: updatedTarget.id, label: updatedTarget.email },
    audience: { permissions: ["team:read"] },
  });

  return res.json(updatedTarget);
};

// Assign roles to user (overwrite roles)
exports.assignRolesToStaffUser = async (req, res) => {
  const targetId = req.params.id;
  const { role } = req.body;

  const target = await prisma.staffUser.findUnique({ where: { id: targetId } });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.isProtected) {
    return res.status(403).json({ error: "Cannot modify protected user" });
  }

  const findRole = await prisma.role.findUnique({ where: { name: role } });
  if (findRole && findRole.protected) {
    return res.status(403).json({ error: "Cannot assign protected role" });
  }

  const updatedTarget = await prisma.staffUser.update({
    where: { id: target.id },
    data: {
      role: findRole ? findRole.name : role,
      tokenVersion: (target.tokenVersion || 0) + 1
    }
  });

  await createNotification({
    type: "staff.user.role",
    title: "Staff role updated",
    message: `${updatedTarget.email} role changed to ${updatedTarget.role}`,
    severity: "critical",
    actor: {
      kind: "staff",
      id: req.staffUser?.id,
      email: req.staffUser?.email,
    },
    target: { kind: "staff", id: updatedTarget.id, label: updatedTarget.email },
    audience: { permissions: ["team:read", "roles:read"] },
  });

  return res.json({ success: true, user: updatedTarget });
};

// list users (with role names populated)
exports.listStaffUsers = async (req, res) => {
  const users = await prisma.staffUser.findMany();
  return res.json(users);
};

// delete user
exports.deleteStaffUser = async (req, res) => {
  const target = await prisma.staffUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Not found" });
  
  if (target.isProtected) {
    return res.status(403).json({ error: "Cannot delete protected user" });
  }

  await prisma.staffUser.delete({ where: { id: target.id } });

  await createNotification({
    type: "staff.user.deleted",
    title: "Staff user deleted",
    message: `Staff user ${target.email} deleted`,
    severity: "critical",
    actor: {
      kind: "staff",
      id: req.staffUser?.id,
      email: req.staffUser?.email,
    },
    target: { kind: "staff", id: target.id, label: target.email },
    audience: { permissions: ["team:read"] },
  });

  return res.json({ success: true });
};

exports.staffUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    const staffUser = await prisma.staffUser.findUnique({ where: { email } });

    if (!staffUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, staffUser.password || "");

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (staffUser.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Staff User is not active. Contact the Admin!",
      });
    }

    const userRole = await prisma.role.findUnique({ where: { name: staffUser.role } });
    if (!userRole) {
      return res.json({
        message: "Error while fetching user role while login",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: staffUser.id,
        email: staffUser.email,
        role: staffUser.role,
        tokenVersion: staffUser.tokenVersion,
        type: "staffUser",
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    await createNotification({
      type: "staff.user.login",
      title: "Staff user login",
      message: `${staffUser.email} logged in`,
      severity: "high",
      actor: { kind: "staff", id: staffUser.id, email: staffUser.email },
      target: { kind: "staff", id: staffUser.id, label: staffUser.email },
      audience: { permissions: ["team:read"] },
    });

    res.cookie(STAFF_AUTH_COOKIE_NAME, token, getStaffAuthCookieOptions());

    res.json({
      success: true,
      message: "Staff login successful",
      staffUser: {
        id: staffUser.id,
        email: staffUser.email,
        role: staffUser.role,
        isProtected: staffUser.isProtected,
        permissions: userRole?.permissions,
      },
    });
  } catch (error) {
    console.error("staff user login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.staffUserProfile = async (req, res) => {
  try {
    const staffUser = await prisma.staffUser.findUnique({
      where: { id: req.staffUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        isProtected: true,
        createdAt: true,
        status: true,
        // omitting password
      }
    });

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: "staffUser not found",
      });
    }

    const roleDoc = await prisma.role.findUnique({ where: { name: staffUser.role } });
    const permissions = Array.isArray(roleDoc?.permissions)
      ? roleDoc.permissions
      : [];

    res.json({
      success: true,
      staffUser: {
        id: staffUser.id,
        email: staffUser.email,
        isProtected: staffUser.isProtected,
        role: staffUser.role,
        permissions,
        createdAt: staffUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.staffUserLogout = (req, res) => {
  const cookieOptions = getStaffAuthCookieOptions();
  res.clearCookie(STAFF_AUTH_COOKIE_NAME, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
  });

  res.json({
    success: true,
    message: "Staff User logout successful",
  });
};

module.exports = exports;
