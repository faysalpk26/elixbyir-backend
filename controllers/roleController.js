// controllers/roleController.js
const prisma = require('../utils/prismaClient');
const { createNotification } = require('../utils/notificationService');

// create role
exports.createRole = async (req, res) => {
  const { name, permissions = [], description = '', protected: isProtected } = req.body;

  // only super_admin should set protected flag (enforce in route via requireRole or check here)
  if (isProtected && !req.user.roles.some(r => r.name === 'super_admin')) {
    return res.status(403).json({ error: 'Only super_admin can create protected role' });
  }

  const role = await prisma.role.create({
    data: { name, permissions, description, protected: !!isProtected }
  });

  await createNotification({
    type: "role.created",
    title: "Role created",
    message: `Role "${role.name}" created`,
    severity: "high",
    actor: { kind: "staff", id: req.staffUser?.id, email: req.staffUser?.email },
    target: { kind: "role", id: role.id, label: role.name },
    audience: { permissions: ["roles:read"] },
  });

  return res.json(role);
};

// list roles
exports.listRoles = async (req, res) => {
  let query = {};
  if(req.query.active) {
    query.active = req.query.active === 'true' || req.query.active === true;
  }

  const roles = await prisma.role.findMany({ where: query });
  return res.json(roles);
};

// get role
exports.getRole = async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Not found' });
  return res.json(role);
};

// update role
exports.updateRole = async (req, res) => {
  const { name, permissions, description, protected: isProtected } = req.body;
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Not found' });

  let updateData = {};

  // prevent non-super changing protected flag
  if (typeof isProtected !== 'undefined' && isProtected !== role.protected) {
    if (req.staffUser.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can change protected flag' });
    }
    updateData.protected = !!isProtected;
  }

  if (name) updateData.name = name;
  if (permissions) updateData.permissions = permissions;
  if (description) updateData.description = description;

  const updatedRole = await prisma.role.update({
    where: { id: role.id },
    data: updateData
  });

  await createNotification({
    type: "role.updated",
    title: "Role updated",
    message: `Role "${updatedRole.name}" updated`,
    severity: "critical",
    actor: { kind: "staff", id: req.staffUser?.id, email: req.staffUser?.email },
    target: { kind: "role", id: updatedRole.id, label: updatedRole.name },
    audience: { permissions: ["roles:read"] },
  });

  return res.json(updatedRole);
};

// delete role
exports.deleteRole = async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Not found' });
  if (role.protected) return res.status(403).json({ error: 'Cannot delete protected role' });
  
  await prisma.role.delete({ where: { id: role.id } });
  
  await createNotification({
    type: "role.deleted",
    title: "Role deleted",
    message: `Role "${role.name}" deleted`,
    severity: "critical",
    actor: { kind: "staff", id: req.staffUser?.id, email: req.staffUser?.email },
    target: { kind: "role", id: role.id, label: role.name },
    audience: { permissions: ["roles:read"] },
  });

  return res.json({ success: true });
};

// toggle role active status
exports.toggleActiveStatus = async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return res.status(404).json({ error: 'Not found' });

  if (role.protected) {
    return res.status(403).json({ error: 'Cannot deactivate protected role' });
  }

  const updatedRole = await prisma.role.update({
    where: { id: role.id },
    data: { active: !role.active }
  });

  await createNotification({
    type: "role.status",
    title: "Role status changed",
    message: `Role "${updatedRole.name}" ${updatedRole.active ? "activated" : "deactivated"}`,
    severity: "high",
    actor: { kind: "staff", id: req.staffUser?.id, email: req.staffUser?.email },
    target: { kind: "role", id: updatedRole.id, label: updatedRole.name },
    audience: { permissions: ["roles:read"] },
  });

  return res.json({ success: true, role: updatedRole });
};

module.exports = exports;
