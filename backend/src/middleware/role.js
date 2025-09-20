import clerkBackend from "@clerk/backend";
const { clerkClient } = clerkBackend;

const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.auth.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user from Clerk
      const user = await clerkClient.users.getUser(userId);
      const userRole = user.unsafeMetadata?.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

export const requireRole = roleMiddleware;
export default roleMiddleware;
